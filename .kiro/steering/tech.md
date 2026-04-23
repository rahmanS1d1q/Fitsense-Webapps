# FitSense — Tech Stack

## Services

| Layer          | Technology                                                        |
| -------------- | ----------------------------------------------------------------- |
| Mobile App     | React Native (iOS + Android)                                      |
| Web Dashboard  | Next.js 14 (App Router) + TypeScript                              |
| API Server     | Node.js + Express + TypeScript                                    |
| ML Service     | Python + FastAPI                                                  |
| MQTT Broker    | EMQX 5                                                            |
| Time-series DB | InfluxDB v2 (bucket: `heartrate` 90 hari, `heartrate_aggregated` 2 tahun) |
| Relational DB  | PostgreSQL 15                                                     |
| Cache / Buffer | Redis 7                                                           |
| Reverse Proxy  | NGINX (`:443` REST, `:8084` MQTT over WSS)                        |
| Container      | Docker Compose                                                    |
| Real-time Web  | mqtt.js via WebSocket                                             |
| Monitoring     | Grafana                                                           |

---

## Port Mapping

| Service          | Port Internal | Port External (production) | Port External (test)  |
| ---------------- | ------------- | -------------------------- | --------------------- |
| NGINX            | —             | `:443` (REST), `:8084` (WSS) | —                   |
| API Server       | `:3001`       | via NGINX                  | `:3002`               |
| ML Service       | `:8000`       | tidak diekspos             | `:8001`               |
| EMQX TCP         | `:1883`       | tidak diekspos (internal)  | `:1884`               |
| EMQX WebSocket   | `:8083`       | via NGINX `:8084`          | `:8085`               |
| EMQX TLS         | `:8883`       | `:8883` (Mobile App)       | —                     |
| PostgreSQL       | `:5432`       | tidak diekspos             | `:5433`               |
| InfluxDB         | `:8086`       | tidak diekspos             | `:8087`               |
| Redis            | `:6379`       | tidak diekspos             | `:6380`               |
| Grafana          | `:3000`       | `:3000`                    | —                     |

---

## Key Libraries

### API Server (Node.js)

| Library                    | Kegunaan                                              |
| -------------------------- | ----------------------------------------------------- |
| `express`                  | HTTP server dan routing                               |
| `jsonwebtoken`             | JWT generation dan verification                       |
| `bcrypt`                   | Password hashing                                      |
| `pg`                       | PostgreSQL client                                     |
| `@influxdata/influxdb-client` | Flux query dan write ke InfluxDB                   |
| `ioredis`                  | Redis client                                          |
| `mqtt`                     | MQTT client untuk subscribe internal ke EMQX          |
| `nodemailer`               | Kirim email reset password                            |
| `node-cron`                | Jadwal OrphanSessionJob (setiap 30 menit)             |
| `fast-check`               | Property-based testing (dev)                          |
| `jest` + `ts-jest`         | Unit test runner (dev)                                |

### ML Service (Python)

| Library           | Kegunaan                                                      |
| ----------------- | ------------------------------------------------------------- |
| `fastapi`         | HTTP framework                                                |
| `uvicorn`         | ASGI server                                                   |
| `pydantic`        | Request/response validation                                   |
| `psycopg2-binary` | PostgreSQL client                                             |
| `influxdb-client` | Flux query ke InfluxDB                                        |
| `redis`           | Redis client untuk ZoneStateTracker dan AlertCooldownManager  |
| `paho-mqtt`       | MQTT client untuk publish alerts ke EMQX `:1883`              |
| `apscheduler`     | Jadwal downsampling harian (pukul 02.00 UTC)                  |
| `hypothesis`      | Property-based testing (dev)                                  |
| `pytest` + `pytest-asyncio` | Test runner (dev)                                   |

### Web Dashboard (Next.js)

| Library                  | Kegunaan                                      |
| ------------------------ | --------------------------------------------- |
| `mqtt`                   | MQTT over WebSocket untuk subscribe real-time |
| `react-window`           | Virtualized list MemberList (maks 100 di DOM) |
| `@tanstack/react-query`  | Data fetching dan caching REST API            |
| `react-hook-form`        | Form handling (login, register, reset password) |
| `zod`                    | Schema validation form                        |

### Mobile App (React Native)

| Library                                    | Kegunaan                               |
| ------------------------------------------ | -------------------------------------- |
| `react-native-ble-plx`                     | BLE scan dan koneksi sensor Coospo     |
| `mqtt` / `@mqtt-client/react-native`       | MQTT publish HR data ke broker         |
| `@react-native-async-storage/async-storage` | Simpan JWT, MQTT_Token, session_id    |
| `react-hook-form`                          | Form login                             |
| `zod`                                      | Schema validation                      |

---

## Environment Variables

```env
# PostgreSQL
DATABASE_URL=postgresql://fitsense:password@postgres:5432/fitsense

# InfluxDB
INFLUX_URL=http://influxdb:8086
INFLUX_TOKEN=your-influx-token
INFLUX_ORG=fitsense
INFLUX_BUCKET=heartrate
INFLUX_BUCKET_AGGREGATED=heartrate_aggregated

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d
MQTT_TOKEN_EXPIRES_IN=30m

# MQTT (internal broker connection — API Server dan ML Service)
MQTT_BROKER_INTERNAL=mqtt://emqx:1883
ML_MQTT_USERNAME=ml_service
ML_MQTT_PASSWORD=your-ml-mqtt-password

# Email (nodemailer — PasswordResetService)
SMTP_HOST=smtp.yourmailprovider.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=FitSense <noreply@yourdomain.com>

# API Server
API_PORT=3001
ML_SERVICE_URL=http://ml:8000

# Web Dashboard (public, di-bundle ke browser)
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_MQTT_URL=wss://yourdomain.com:8084
```

---

## Common Commands

```bash
# Start semua service (production)
docker compose up -d

# Rebuild service tertentu
docker compose build api
docker compose up -d api

# View logs
docker compose logs -f api
docker compose logs -f ml
docker compose logs -f emqx

# Jalankan migrasi PostgreSQL (production)
cd apps/api && npm run db:migrate

# Jalankan migrasi PostgreSQL (test DB)
cd apps/api && npm run db:migrate:test

# Setup test environment (spin up, migrate, run all tests, teardown)
bash scripts/test-setup.sh

# Bersihkan data test (PostgreSQL TRUNCATE + Redis FLUSHDB + InfluxDB deleteData)
bash scripts/db-clean.sh

# Development lokal — API Server
cd apps/api && npm install && npm run dev

# Development lokal — Web Dashboard
cd apps/web && npm install && npm run dev

# Development lokal — ML Service
cd apps/ml && pip install -r requirements.txt && uvicorn main:app --reload

# Run unit + property tests — API Server
cd apps/api && npm test

# Run unit + property tests — ML Service
cd apps/ml && pytest

# Run property tests saja — API Server
cd apps/api && npm test -- --testPathPattern=property

# Run property tests saja — ML Service
cd apps/ml && pytest tests/property/
```

---

## MQTT Routing

- **Mobile App** → EMQX port `:8883` (MQTT over TLS, native MQTT client, tidak melalui NGINX)
- **Web Dashboard** → NGINX `:8084` → EMQX `:8083` (MQTT over WSS, browser mqtt.js)
- **API Server** → EMQX `:1883` (MQTT internal, subscribe `fitsense/#` via MqttConsumer)
- **ML Service** → EMQX `:1883` (MQTT internal, publish alerts via paho-mqtt)
- **EMQX auth/ACL** → webhook ke API Server (`POST /api/mqtt/auth`, `POST /api/mqtt/acl`)
- **MQTT topic pattern**: `fitsense/{club_id}/{user_id}/hr` dan `fitsense/{club_id}/{user_id}/alerts`