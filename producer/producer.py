import socket
import json
import time
import os
import requests
from datetime import datetime

API_KEY     = os.environ.get("OWM_API_KEY", "")
SOCKET_HOST = os.environ.get("SOCKET_HOST", "0.0.0.0")
SOCKET_PORT = int(os.environ.get("SOCKET_PORT", 9999))
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", 60))

CITIES = [
    {"name": "Santa Cruz de Tenerife",    "island": "Tenerife",      "lat": 28.4636, "lon": -16.2518},
    {"name": "Las Palmas de Gran Canaria","island": "Gran Canaria",   "lat": 28.1235, "lon": -15.4366},
    {"name": "Arrecife",                  "island": "Lanzarote",      "lat": 28.9637, "lon": -13.5477},
    {"name": "Puerto del Rosario",        "island": "Fuerteventura",  "lat": 28.4997, "lon": -13.8627},
    {"name": "Santa Cruz de La Palma",    "island": "La Palma",       "lat": 28.6835, "lon": -17.7642},
    {"name": "San Sebastián de La Gomera","island": "La Gomera",      "lat": 28.0916, "lon": -17.1133},
    {"name": "Valverde",                  "island": "El Hierro",      "lat": 27.8125, "lon": -17.9145},
]

OWM_WEATHER = "https://api.openweathermap.org/data/2.5/weather"
OWM_AIR     = "https://api.openweathermap.org/data/2.5/air_pollution"

AQI_LABEL = {1: "Bueno", 2: "Aceptable", 3: "Moderado", 4: "Malo", 5: "Muy malo"}


def fetch_weather(city):
    try:
        r = requests.get(OWM_WEATHER, params={
            "lat": city["lat"], "lon": city["lon"],
            "appid": API_KEY, "units": "metric", "lang": "es"
        }, timeout=10)
        r.raise_for_status()
        d = r.json()
        return {
            "temp":         d["main"]["temp"],
            "feels_like":   d["main"]["feels_like"],
            "humidity":     d["main"]["humidity"],
            "pressure":     d["main"]["pressure"],
            "wind_speed":   d["wind"]["speed"] * 3.6,
            "wind_deg":     d["wind"].get("deg", 0),
            "clouds":       d["clouds"]["all"],
            "visibility":   d.get("visibility", 10000),
            "weather_id":   d["weather"][0]["id"],
            "weather_desc": d["weather"][0]["description"],
        }
    except Exception as e:
        print(f"[ERROR weather] {city['island']}: {e}")
        return None


def fetch_air(city):
    try:
        r = requests.get(OWM_AIR, params={
            "lat": city["lat"], "lon": city["lon"], "appid": API_KEY
        }, timeout=10)
        r.raise_for_status()
        d    = r.json()["list"][0]
        aqi  = int(d["main"]["aqi"])
        comp = d["components"]
        return {
            "aqi":       aqi,
            "aqi_label": AQI_LABEL.get(aqi, "—"),
            "co":        round(comp.get("co",    0), 2),
            "no":        round(comp.get("no",    0), 2),
            "no2":       round(comp.get("no2",   0), 2),
            "o3":        round(comp.get("o3",    0), 2),
            "so2":       round(comp.get("so2",   0), 2),
            "pm2_5":     round(comp.get("pm2_5", 0), 2),
            "pm10":      round(comp.get("pm10",  0), 2),
            "nh3":       round(comp.get("nh3",   0), 2),
        }
    except Exception as e:
        print(f"[ERROR air] {city['island']}: {e}")
        return None


def serve(conn):
    print("[PRODUCER] Client connected, starting stream...")
    while True:
        batch = []
        for city in CITIES:
            weather = fetch_weather(city)
            air     = fetch_air(city)
            if not weather:
                continue

            record = {
                "timestamp":    datetime.utcnow().isoformat(),
                "island":       city["island"],
                "city":         city["name"],
                "lat":          city["lat"],
                "lon":          city["lon"],
                **weather,
                # Calidad del aire (None si falla)
                "aqi":          air["aqi"]       if air else None,
                "aqi_label":    air["aqi_label"] if air else None,
                "co":           air["co"]        if air else None,
                "no2":          air["no2"]       if air else None,
                "o3":           air["o3"]        if air else None,
                "so2":          air["so2"]       if air else None,
                "pm2_5":        air["pm2_5"]     if air else None,
                "pm10":         air["pm10"]      if air else None,
                "nh3":          air["nh3"]       if air else None,
            }
            batch.append(record)

            aqi_str = f"AQI:{air['aqi']} ({air['aqi_label']})" if air else "AQI:—"
            print(f"[OK] {record['island']:25s} | {record['temp']:5.1f}°C | "
                  f"{record['wind_speed']:5.1f} km/h | {aqi_str} | PM2.5:{air['pm2_5'] if air else '—'}")

        for record in batch:
            try:
                conn.sendall((json.dumps(record) + "\n").encode("utf-8"))
            except BrokenPipeError:
                print("[PRODUCER] Client disconnected.")
                return

        print(f"[PRODUCER] Batch sent ({len(batch)} cities). Sleeping {POLL_INTERVAL}s...\n")
        time.sleep(POLL_INTERVAL)


def main():
    print(f"[PRODUCER] Starting on {SOCKET_HOST}:{SOCKET_PORT}")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((SOCKET_HOST, SOCKET_PORT))
        s.listen(1)
        print("[PRODUCER] Waiting for Spark...")
        while True:
            conn, addr = s.accept()
            print(f"[PRODUCER] Connection from {addr}")
            try:
                serve(conn)
            except Exception as e:
                print(f"[PRODUCER] Error: {e}")
            finally:
                conn.close()


if __name__ == "__main__":
    main()