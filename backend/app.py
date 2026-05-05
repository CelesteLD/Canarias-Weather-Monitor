from flask import Flask, jsonify, request
from flask_cors import CORS
from collections import deque
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Estado en memoria: último dato por isla + historial de alertas
weather_state: dict[str, dict] = {}
alert_history: deque = deque(maxlen=100)


@app.route("/api/ingest", methods=["POST"])
def ingest():
    """Recibe datos procesados de Spark."""
    data = request.json
    if not data:
        return jsonify({"error": "no data"}), 400

    for item in data:
        island = item.get("island")
        if not island:
            continue
        weather_state[island] = item

        # Guardar alertas en historial
        for alert_msg in item.get("alerts", []):
            alert_history.appendleft({
                "island":    island,
                "message":   alert_msg,
                "level":     item.get("alert_level", 0),
                "timestamp": item.get("timestamp", datetime.utcnow().isoformat()),
            })

    return jsonify({"ok": True, "islands": len(data)})


@app.route("/api/weather", methods=["GET"])
def get_weather():
    """Estado actual de todas las islas."""
    return jsonify(list(weather_state.values()))


@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    """Historial de alertas recientes."""
    return jsonify(list(alert_history))


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "islands_tracked": len(weather_state)})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
