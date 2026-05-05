# 🌊 Canarias Weather Monitor

Sistema de vigilancia meteorológica en tiempo real sobre el Archipiélago Canario,
construido con **PySpark Structured Streaming**, **Flask** y **React**.

## Arquitectura

```
OpenWeatherMap API
      │ (poll cada 60s, 7 islas)
      ▼
 producer.py  ──TCP:9999──►  PySpark Structured Streaming
                                      │
                              ventana deslizante 10min
                              detección de umbrales
                              correlación de presión
                                      │
                                      ▼
                               Flask REST API  ◄──── React Frontend
                                                      (mapa SVG + alertas)
```

## Requisitos

- Docker Desktop
- Docker Compose v2
- API Key de [OpenWeatherMap](https://openweathermap.org/api) (gratuita)

## Despliegue rápido

```bash
# 1. Clona o descarga el proyecto
cd canarias-weather

# 2. Copia el fichero de entorno y añade tu API key
cp .env.example .env
# Edita .env y sustituye TU_API_KEY_AQUI por tu clave real

# 3. Levanta todos los servicios
docker compose up --build

# 4. Abre el navegador
open http://localhost:3000
```

## Servicios

| Servicio   | Puerto | Descripción                          |
|------------|--------|--------------------------------------|
| frontend   | 3000   | Interfaz React con mapa de Canarias  |
| backend    | 5000   | Flask REST API                       |
| producer   | 9999   | Socket TCP con datos OWM             |
| spark      | —      | PySpark Structured Streaming         |

## API Endpoints

| Endpoint         | Método | Descripción                         |
|------------------|--------|-------------------------------------|
| `/api/weather`   | GET    | Estado actual de las 7 islas        |
| `/api/alerts`    | GET    | Historial de alertas (últimas 100)  |
| `/api/health`    | GET    | Estado del backend                  |
| `/api/ingest`    | POST   | Receptor de datos desde Spark       |

## Umbrales de alerta

| Parámetro     | Aviso 🟡   | Peligro 🔴  |
|---------------|------------|-------------|
| Temperatura   | —          | > 38°C / < 5°C |
| Viento        | > 60 km/h  | > 78 km/h   |
| Humedad       | > 90%      | —           |
| Visibilidad   | < 1000m    | < 500m      |
| Δ Presión     | > 3 hPa    | > 6 hPa     |
| Código OWM    | —          | 2xx (tormenta) |

## Detener

```bash
docker compose down
```
