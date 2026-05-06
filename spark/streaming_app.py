import os
import json
import requests
from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, window, avg, max as spark_max, min as spark_min, to_timestamp
)
from pyspark.sql.types import *

SOCKET_HOST = os.environ.get("SOCKET_HOST", "producer")
SOCKET_PORT = int(os.environ.get("SOCKET_PORT", 9999))
FLASK_HOST  = os.environ.get("FLASK_HOST", "backend")
FLASK_PORT  = int(os.environ.get("FLASK_PORT", 5000))
FLASK_URL   = f"http://{FLASK_HOST}:{FLASK_PORT}/api/ingest"

# ── Umbrales meteorológicos ───────────────────────────────────────────────────
TEMP_HIGH      = 38.0
TEMP_LOW       = 5.0
WIND_WARNING   = 60.0
HUMIDITY_HIGH  = 90.0
VISIBILITY_LOW = 1000
PRESSURE_DROP  = 3.0
STORM_MIN      = 200
STORM_MAX      = 299

# ── Umbrales calidad del aire ─────────────────────────────────────────────────
PM25_WARNING = 25.0;  PM25_DANGER = 50.0
PM10_WARNING = 50.0;  PM10_DANGER = 100.0
NO2_WARNING  = 40.0;  NO2_DANGER  = 100.0
O3_WARNING   = 100.0; O3_DANGER   = 180.0

# ── Schema ────────────────────────────────────────────────────────────────────
SCHEMA = StructType([
    StructField("timestamp",    StringType(),  True),
    StructField("island",       StringType(),  True),
    StructField("city",         StringType(),  True),
    StructField("lat",          DoubleType(),  True),
    StructField("lon",          DoubleType(),  True),
    StructField("temp",         DoubleType(),  True),
    StructField("feels_like",   DoubleType(),  True),
    StructField("humidity",     IntegerType(), True),
    StructField("pressure",     DoubleType(),  True),
    StructField("grnd_level",   DoubleType(),  True),
    StructField("wind_speed",   DoubleType(),  True),
    StructField("wind_deg",     IntegerType(), True),
    StructField("wind_gust",    DoubleType(),  True),
    StructField("rain_1h",      DoubleType(),  True),
    StructField("snow_1h",      DoubleType(),  True),
    StructField("clouds",       IntegerType(), True),
    StructField("visibility",   IntegerType(), True),
    StructField("weather_id",   IntegerType(), True),
    StructField("weather_desc", StringType(),  True),
    StructField("sunrise",      LongType(),    True),
    StructField("sunset",       LongType(),    True),
    StructField("aqi",          IntegerType(), True),
    StructField("aqi_label",    StringType(),  True),
    StructField("co",           DoubleType(),  True),
    StructField("no2",          DoubleType(),  True),
    StructField("o3",           DoubleType(),  True),
    StructField("so2",          DoubleType(),  True),
    StructField("pm2_5",        DoubleType(),  True),
    StructField("pm10",         DoubleType(),  True),
    StructField("nh3",          DoubleType(),  True),
    StructField("forecast",     StringType(),  True),
])


def compute_weather_alert(r):
    danger = (
        (r.temp       is not None and (r.temp > TEMP_HIGH or r.temp < TEMP_LOW)) or
        (r.wind_speed is not None and r.wind_speed > WIND_WARNING * 1.3) or
        (r.wind_gust  is not None and r.wind_gust  > WIND_WARNING * 1.5) or
        (r.visibility is not None and r.visibility < 500) or
        (r.weather_id is not None and STORM_MIN <= r.weather_id <= STORM_MAX)
    )
    warning = (
        (r.wind_speed is not None and r.wind_speed > WIND_WARNING) or
        (r.wind_gust  is not None and r.wind_gust  > WIND_WARNING) or
        (r.humidity   is not None and r.humidity   > HUMIDITY_HIGH) or
        (r.visibility is not None and r.visibility < VISIBILITY_LOW) or
        (r.rain_1h    is not None and r.rain_1h    > 10)
    )
    return 2 if danger else 1 if warning else 0


def compute_air_alert(r):
    danger = (
        (r.pm2_5 is not None and r.pm2_5 > PM25_DANGER) or
        (r.pm10  is not None and r.pm10  > PM10_DANGER) or
        (r.no2   is not None and r.no2   > NO2_DANGER) or
        (r.o3    is not None and r.o3    > O3_DANGER) or
        (r.aqi   is not None and r.aqi   >= 4)
    )
    warning = (
        (r.pm2_5 is not None and r.pm2_5 > PM25_WARNING) or
        (r.pm10  is not None and r.pm10  > PM10_WARNING) or
        (r.no2   is not None and r.no2   > NO2_WARNING) or
        (r.o3    is not None and r.o3    > O3_WARNING) or
        (r.aqi   is not None and r.aqi   == 3)
    )
    return 2 if danger else 1 if warning else 0


def build_weather_alerts(r, pressure_drop):
    alerts = []
    if r.temp       and r.temp > TEMP_HIGH:             alerts.append(f"🌡️ Temperatura extrema: {r.temp:.1f}°C")
    if r.temp       and r.temp < TEMP_LOW:              alerts.append(f"🥶 Temperatura muy baja: {r.temp:.1f}°C")
    if r.wind_speed and r.wind_speed > WIND_WARNING:    alerts.append(f"💨 Viento fuerte: {r.wind_speed:.1f} km/h")
    if r.wind_gust  and r.wind_gust  > WIND_WARNING:    alerts.append(f"🌪️ Racha peligrosa: {r.wind_gust:.1f} km/h")
    if r.rain_1h    and r.rain_1h    > 10:              alerts.append(f"🌧️ Lluvia intensa: {r.rain_1h:.1f} mm/h")
    if r.humidity   and r.humidity   > HUMIDITY_HIGH:   alerts.append(f"💧 Humedad crítica: {r.humidity}%")
    if r.visibility and r.visibility < VISIBILITY_LOW:  alerts.append(f"👁️ Visibilidad reducida: {r.visibility}m")
    if pressure_drop > PRESSURE_DROP:                   alerts.append(f"⬇️ Caída de presión: {pressure_drop:.1f} hPa")
    if r.weather_id and STORM_MIN <= r.weather_id <= STORM_MAX:
        alerts.append(f"⛈️ Tormenta: {r.weather_desc}")
    return alerts


def build_air_alerts(r):
    alerts = []
    if r.aqi   and r.aqi   >= 3:              alerts.append(f"🌫️ Calidad del aire: {r.aqi_label} (AQI {r.aqi})")
    if r.pm2_5 and r.pm2_5 > PM25_WARNING:   alerts.append(f"🔬 PM2.5 elevado: {r.pm2_5:.1f} µg/m³")
    if r.pm10  and r.pm10  > PM10_WARNING:   alerts.append(f"🔬 PM10 elevado: {r.pm10:.1f} µg/m³ (posible calima)")
    if r.no2   and r.no2   > NO2_WARNING:    alerts.append(f"☠️ NO₂ elevado: {r.no2:.1f} µg/m³")
    if r.o3    and r.o3    > O3_WARNING:     alerts.append(f"☀️ Ozono elevado: {r.o3:.1f} µg/m³")
    return alerts


def send_to_backend(batch_df, batch_id):
    rows = batch_df.collect()
    if not rows:
        return

    pressure_map = {}
    for r in rows:
        if r.island not in pressure_map:
            pressure_map[r.island] = {"max": r.pressure, "min": r.pressure}
        else:
            pressure_map[r.island]["max"] = max(pressure_map[r.island]["max"], r.pressure)
            pressure_map[r.island]["min"] = min(pressure_map[r.island]["min"], r.pressure)

    payload = []
    for r in rows:
        p_drop         = pressure_map[r.island]["max"] - pressure_map[r.island]["min"]
        weather_level  = compute_weather_alert(r)
        air_level      = compute_air_alert(r)
        weather_alerts = build_weather_alerts(r, p_drop)
        air_alerts     = build_air_alerts(r)

        payload.append({
            "island":        r.island,
            "city":          r.city,
            "lat":           r.lat,
            "lon":           r.lon,
            "timestamp":     r.timestamp,
            "temp":          r.temp,
            "feels_like":    r.feels_like,
            "humidity":      r.humidity,
            "pressure":      r.pressure,
            "grnd_level":    r.grnd_level,
            "pressure_drop": round(p_drop, 2),
            "wind_speed":    round(r.wind_speed, 1) if r.wind_speed else None,
            "wind_deg":      r.wind_deg,
            "wind_gust":     round(r.wind_gust, 1) if r.wind_gust else 0,
            "rain_1h":       round(r.rain_1h, 2)   if r.rain_1h   else 0,
            "clouds":        r.clouds,
            "visibility":    r.visibility,
            "weather_id":    r.weather_id,
            "weather_desc":  r.weather_desc,
            "sunrise":       r.sunrise,
            "sunset":        r.sunset,
            "alert_level":   weather_level,
            "alerts":        weather_alerts,
            "aqi":           r.aqi,
            "aqi_label":     r.aqi_label,
            "co":            r.co,
            "no2":           r.no2,
            "o3":            r.o3,
            "so2":           r.so2,
            "pm2_5":         r.pm2_5,
            "pm10":          r.pm10,
            "nh3":           r.nh3,
            "air_alert_level": air_level,
            "air_alerts":    air_alerts,
            "forecast":      json.loads(r.forecast) if r.forecast else [],
        })

    for item in payload:
        lvl_w = ['🟢','🟡','🔴'][item['alert_level']]
        lvl_a = ['🟢','🟡','🔴'][item['air_alert_level']]
        print(f"[SPARK] {item['island']:25s} | {item['temp']:5.1f}°C | "
              f"racha:{item['wind_gust']:5.1f} km/h | lluvia:{item['rain_1h']} mm | "
              f"AQI:{item['aqi']} | Meteo:{lvl_w} Aire:{lvl_a}")

    try:
        requests.post(FLASK_URL, json=payload, timeout=5)
    except Exception as e:
        print(f"[SPARK] Backend no disponible: {e}")


def main():
    spark = SparkSession.builder \
        .appName("CanariasWeatherMonitor") \
        .config("spark.sql.shuffle.partitions", "4") \
        .getOrCreate()
    spark.sparkContext.setLogLevel("WARN")

    raw = spark.readStream.format("socket") \
        .option("host", SOCKET_HOST).option("port", SOCKET_PORT).load()

    parsed = raw \
        .select(from_json(col("value"), SCHEMA).alias("d")).select("d.*") \
        .withColumn("event_time", to_timestamp(col("timestamp")))

    windowed = parsed \
        .withWatermark("event_time", "5 minutes") \
        .groupBy(
            window(col("event_time"), "10 minutes", "5 minutes"),
            col("island"), col("city"), col("lat"), col("lon"),
            col("weather_id"), col("weather_desc"), col("aqi_label"),
        ).agg(
            avg("temp").alias("temp"),
            avg("feels_like").alias("feels_like"),
            avg("humidity").alias("humidity"),
            avg("pressure").alias("pressure"),
            avg("grnd_level").alias("grnd_level"),
            spark_max("wind_speed").alias("wind_speed"),
            avg("wind_deg").alias("wind_deg"),
            spark_max("wind_gust").alias("wind_gust"),
            avg("rain_1h").alias("rain_1h"),
            avg("clouds").alias("clouds"),
            spark_min("visibility").alias("visibility"),
            avg("aqi").alias("aqi"),
            avg("co").alias("co"),
            avg("no2").alias("no2"),
            avg("o3").alias("o3"),
            avg("so2").alias("so2"),
            avg("pm2_5").alias("pm2_5"),
            avg("pm10").alias("pm10"),
            avg("nh3").alias("nh3"),
            spark_max("sunrise").alias("sunrise"),
            spark_max("sunset").alias("sunset"),
            spark_max("forecast").alias("forecast"),
        ).select(
            col("island"), col("city"), col("lat"), col("lon"),
            col("window.start").cast("string").alias("timestamp"),
            col("temp"), col("feels_like"), col("humidity"),
            col("pressure"), col("grnd_level"),
            col("wind_speed"), col("wind_deg"), col("wind_gust"),
            col("rain_1h"), col("clouds"), col("visibility"),
            col("weather_id"), col("weather_desc"),
            col("aqi").cast("integer"), col("aqi_label"),
            col("co"), col("no2"), col("o3"), col("so2"),
            col("pm2_5"), col("pm10"), col("nh3"),
            col("sunrise").cast("long"), col("sunset").cast("long"),
            col("forecast"),
        )

    query = windowed.writeStream \
        .outputMode("update") \
        .foreachBatch(send_to_backend) \
        .trigger(processingTime="30 seconds") \
        .start()

    query.awaitTermination()


if __name__ == "__main__":
    main()