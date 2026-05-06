from flask import Flask, jsonify, request
from flask_cors import CORS
from collections import deque
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import os, json, requests, threading, time

app = Flask(__name__)
CORS(app)

# ── Estado meteorológico islas ────────────────────────────────────────────────
weather_state: dict = {}
alert_history: deque = deque(maxlen=100)

# ── Estado municipios ─────────────────────────────────────────────────────────
municipio_temps: dict  = {}
muni_status            = 'idle'
muni_last_batch        = None
muni_last_update       = None
muni_clients           = 0
muni_active            = threading.Event()   # señal: hay clientes activos

API_KEY     = os.environ.get("OWM_API_KEY", "")
OWM_WEATHER = "https://api.openweathermap.org/data/2.5/weather"
POLL_INTERVAL = 60


def load_municipios():
    for path in ['/app/municipios_centroids.json', 'municipios_centroids.json']:
        if os.path.exists(path):
            with open(path) as f:
                data = json.load(f)
            print(f"[MUNI] Cargados {len(data)} municipios desde {path}")
            return data
    print("[MUNI] ERROR: municipios_centroids.json no encontrado")
    return []

MUNICIPIOS = load_municipios()
BATCH_A = MUNICIPIOS[:44]
BATCH_B = MUNICIPIOS[44:]


def fetch_temp(municipio):
    try:
        r = requests.get(OWM_WEATHER, params={
            "lat": municipio["lat"], "lon": municipio["lon"],
            "appid": API_KEY, "units": "metric"
        }, timeout=10)
        r.raise_for_status()
        d = r.json()
        return {
            "codigo":       municipio["codigo"],
            "nombre":       municipio["nombre"],
            "isla":         municipio["isla"],
            "lat":          municipio["lat"],
            "lon":          municipio["lon"],
            "temp":         round(d["main"]["temp"], 1),
            "feels_like":   round(d["main"]["feels_like"], 1),
            "humidity":     d["main"]["humidity"],
            "weather_desc": d["weather"][0]["description"],
            "updated_at":   datetime.utcnow().isoformat(),
        }
    except Exception as e:
        print(f"[MUNI ERROR] {municipio['nombre']}: {e}")
        return None


def fetch_batch_parallel(batch):
    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(fetch_temp, m): m for m in batch}
        for future in as_completed(futures):
            data = future.result()
            if data:
                results.append(data)
    return results


def muni_worker():
    global muni_status, muni_last_batch, muni_last_update
    print("[MUNI] Worker arrancado, esperando clientes...")
    batch_index = 0

    while True:
        # Bloquear hasta que haya al menos un cliente activo
        muni_active.wait()

        batch = BATCH_A if batch_index % 2 == 0 else BATCH_B
        label = 'A' if batch_index % 2 == 0 else 'B'
        muni_status     = f'fetching_{label}'
        muni_last_batch = label
        print(f"[MUNI] Descargando lote {label} ({len(batch)} municipios en paralelo)...")

        results = fetch_batch_parallel(batch)
        for data in results:
            municipio_temps[data["codigo"]] = data

        muni_last_update = datetime.utcnow()
        print(f"[MUNI] Lote {label} completado: {len(results)}/{len(batch)} municipios OK")

        batch_index += 1
        muni_status = 'waiting'

        # Esperar POLL_INTERVAL segundos (o menos si se desactiva)
        for _ in range(POLL_INTERVAL):
            if not muni_active.is_set():
                print("[MUNI] Sin clientes, pausando")
                muni_status = 'idle'
                break
            time.sleep(1)


threading.Thread(target=muni_worker, daemon=True).start()


# ── Endpoints islas ───────────────────────────────────────────────────────────
@app.route("/api/ingest", methods=["POST"])
def ingest():
    data = request.json
    if not data:
        return jsonify({"error": "no data"}), 400
    for item in data:
        island = item.get("island")
        if not island:
            continue
        weather_state[island] = item
        existing = {(a["island"], a["message"]) for a in alert_history}
        for msg in item.get("alerts", []):
            if (island, msg) not in existing:
                alert_history.appendleft({"island": island, "message": msg, "level": item.get("alert_level", 0), "timestamp": item.get("timestamp", datetime.utcnow().isoformat())})
                existing.add((island, msg))
        for msg in item.get("air_alerts", []):
            if (island, msg) not in existing:
                alert_history.appendleft({"island": island, "message": msg, "level": item.get("air_alert_level", 0), "timestamp": item.get("timestamp", datetime.utcnow().isoformat()), "type": "air"})
                existing.add((island, msg))
    return jsonify({"ok": True})


@app.route("/api/weather",  methods=["GET"])
def get_weather():  return jsonify(list(weather_state.values()))

@app.route("/api/alerts",   methods=["GET"])
def get_alerts():   return jsonify(list(alert_history))

@app.route("/api/forecast/<island>", methods=["GET"])
def get_forecast(island):
    data = weather_state.get(island)
    return jsonify(data.get("forecast", []) if data else [])

@app.route("/api/health",   methods=["GET"])
def health():       return jsonify({"status": "ok", "islands": len(weather_state)})


# ── Endpoints municipios ──────────────────────────────────────────────────────
@app.route("/api/municipios/activate", methods=["POST"])
def activate():
    global muni_clients
    muni_clients += 1
    muni_active.set()
    print(f"[MUNI] Activate → clientes: {muni_clients}")
    return jsonify({"ok": True, "clients": muni_clients})


@app.route("/api/municipios/deactivate", methods=["POST"])
def deactivate():
    global muni_clients
    muni_clients = max(0, muni_clients - 1)
    if muni_clients == 0:
        muni_active.clear()
    print(f"[MUNI] Deactivate → clientes: {muni_clients}")
    return jsonify({"ok": True, "clients": muni_clients})


@app.route("/api/municipios/temps", methods=["GET"])
def get_temps():
    now = datetime.utcnow()
    next_in = None
    if muni_last_update and muni_status == 'waiting':
        elapsed = (now - muni_last_update).total_seconds()
        next_in = max(0, int(POLL_INTERVAL - elapsed))
    return jsonify({
        "temps":        list(municipio_temps.values()),
        "status":       muni_status,
        "last_batch":   muni_last_batch,
        "last_update":  muni_last_update.isoformat() if muni_last_update else None,
        "next_in_secs": next_in,
        "total":        len(municipio_temps),
        "clients":      muni_clients,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)