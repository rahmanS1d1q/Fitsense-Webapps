# FitSense — Kiro AI Spec

## Project overview

FitSense adalah platform SaaS multi-tenant untuk monitoring heart rate real-time di gym. Setiap club gym bisa mendaftarkan diri, pelatih memantau semua member secara live, dan sistem ML memberikan rekomendasi latihan serta peringatan anomali HR.

---

## Tech stack

| Layer | Technology |
|---|---|
| Mobile app | React Native (iOS + Android) |
| Web dashboard | Next.js 14 (App Router) |
| API server | Node.js + Express |
| ML service | Python + FastAPI |
| MQTT broker | EMQX |
| Time-series DB | InfluxDB v2 |
| Relational DB | PostgreSQL 15 |
| Cache / queue | Redis |
| Reverse proxy | NGINX |
| Container | Docker Compose |
| Real-time web | mqtt.js (WebSocket) |

---

## Roles & permissions

| Role | Akses |
|---|---|
| `super_admin` | Lihat dan kelola semua club, semua member, semua data |
| `club_owner` | Kelola club sendiri, lihat semua member club-nya |
| `trainer` | Lihat semua member club-nya (read-only) |
| `member` | Lihat data diri sendiri saja |

---

## Database schema — PostgreSQL

### Table: `clubs`
```sql
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) UNIQUE NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active', -- active | suspended
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL, -- super_admin | club_owner | trainer | member
  age INTEGER,
  gender VARCHAR(10),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `sessions`
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  club_id UUID REFERENCES clubs(id),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  avg_hr INTEGER,
  max_hr INTEGER,
  min_hr INTEGER,
  duration_minutes INTEGER,
  hr_zone VARCHAR(20), -- fat_burn | cardio | peak
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `ml_recommendations`
```sql
CREATE TABLE ml_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  session_id UUID REFERENCES sessions(id),
  type VARCHAR(30) NOT NULL, -- workout_recommendation | anomaly_alert | zone_summary
  content JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `devices`
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  club_id UUID REFERENCES clubs(id),
  device_type VARCHAR(50), -- coospo_h6 | coospo_hw706
  mac_address VARCHAR(20),
  registered_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## InfluxDB schema

**Bucket:** `heartrate`

**Measurement:** `hr_data`

| Field/Tag | Type | Keterangan |
|---|---|---|
| `club_id` | tag | isolasi per club |
| `user_id` | tag | isolasi per member |
| `session_id` | tag | grouping per sesi |
| `hr` | field (int) | heart rate value (bpm) |
| `rr` | field (float) | RR interval (ms) |
| `hr_zone` | field (string) | fat_burn / cardio / peak |
| `_time` | timestamp | auto dari InfluxDB |

---

## MQTT topic structure

```
fitsense/{club_id}/{user_id}/hr
```

**Payload (JSON):**
```json
{
  "hr": 85,
  "rr": 705.8,
  "session_id": "uuid",
  "timestamp": 1714000000000
}
```

**ACL rules:**
- `mobile app` → publish only ke `fitsense/{club_id}/{user_id}/hr` miliknya
- `trainer/club_owner` → subscribe `fitsense/{club_id}/#` (semua member club-nya)
- `member` → subscribe `fitsense/{club_id}/{user_id}/hr` miliknya saja
- `super_admin` → subscribe `fitsense/#`
- Semua client dashboard → **dilarang publish**

---

## API endpoints — Node.js / Express

### Auth
```
POST   /api/auth/register-club     — daftarkan club baru
POST   /api/auth/login             — login semua role
POST   /api/auth/logout
POST   /api/auth/mqtt-token        — generate short-lived MQTT token (30 menit)
POST   /api/auth/refresh
```

### Clubs (super_admin only)
```
GET    /api/clubs                  — list semua club
GET    /api/clubs/:clubId
PATCH  /api/clubs/:clubId
DELETE /api/clubs/:clubId
```

### Members
```
GET    /api/clubs/:clubId/members  — trainer/owner: semua member
POST   /api/clubs/:clubId/members  — tambah member baru
GET    /api/clubs/:clubId/members/:userId
PATCH  /api/clubs/:clubId/members/:userId
DELETE /api/clubs/:clubId/members/:userId
```

### Sessions
```
GET    /api/clubs/:clubId/members/:userId/sessions
GET    /api/clubs/:clubId/members/:userId/sessions/:sessionId
POST   /api/sessions/start         — dari mobile app
POST   /api/sessions/end           — dari mobile app
```

### HR History (query InfluxDB)
```
GET    /api/clubs/:clubId/members/:userId/hr
       ?from=ISO8601&to=ISO8601&interval=1m
```

### ML / Recommendations
```
GET    /api/clubs/:clubId/members/:userId/recommendations
GET    /api/clubs/:clubId/members/:userId/recommendations/latest
POST   /api/ml/trigger/:userId     — trigger manual ML inference
```

### EMQX Auth Webhook
```
POST   /api/mqtt/auth              — dipanggil EMQX saat client connect
POST   /api/mqtt/acl               — dipanggil EMQX saat client subscribe/publish
```

---

## ML service — Python / FastAPI

### Endpoint
```
POST   /ml/analyze-session         — dipanggil setelah sesi selesai
POST   /ml/anomaly-check           — dipanggil real-time per data point
GET    /ml/health
```

### Feature 1 — HR anomaly alert (real-time)

**Trigger:** setiap data point masuk via MQTT consumer

**Logic:**
```python
max_hr = 220 - user.age

# Zona HR
fat_burn_min = max_hr * 0.50
fat_burn_max = max_hr * 0.60
cardio_min   = max_hr * 0.60
cardio_max   = max_hr * 0.70
peak_min     = max_hr * 0.80

# Anomali
if hr > max_hr * 0.95:
    alert = "CRITICAL: HR mendekati batas maksimal"
elif hr > max_hr * 0.85 and duration_in_zone > 10_minutes:
    alert = "WARNING: HR tinggi terlalu lama"
elif hr < 40:
    alert = "WARNING: HR terlalu rendah, periksa sensor"
```

**Output:** push ke MQTT topic `fitsense/{club_id}/{user_id}/alerts`

---

### Feature 2 — Rekomendasi latihan (batch, post-session)

**Trigger:** sesi selesai (`POST /ml/analyze-session`)

**Input:**
- Histori 5 sesi terakhir user
- Avg HR, max HR, durasi, HR zone tiap sesi
- Umur dan gender user

**Logic:**
```python
# Jika 3 sesi terakhir avg HR selalu di peak zone:
#   → Rekomendasi: turunkan intensitas, tambah recovery
# Jika avg HR turun dibanding 2 minggu lalu:
#   → Rekomendasi: tingkatkan intensitas
# Jika durasi di fat_burn zone < 20 menit:
#   → Rekomendasi: perpanjang sesi di zona fat burn
```

**Output:** simpan ke `ml_recommendations` di PostgreSQL

---

### Feature 3 — HR zone classifier (real-time ringan)

**Logic:**
```python
def classify_zone(hr, age):
    max_hr = 220 - age
    pct = hr / max_hr
    if pct < 0.50: return "rest"
    if pct < 0.60: return "fat_burn"
    if pct < 0.70: return "cardio"
    if pct < 0.80: return "aerobic"
    return "peak"
```

**Output:** disertakan langsung di setiap payload HR yang di-broadcast

---

## Docker Compose services

```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["443:443", "8084:8084"]
    depends_on: [api, emqx]

  api:
    build: ./apps/api
    environment:
      - DATABASE_URL=postgresql://...
      - INFLUX_URL=http://influxdb:8086
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=...
      - MQTT_BROKER=mqtt://emqx:1883
    depends_on: [postgres, influxdb, redis, emqx]

  ml:
    build: ./apps/ml
    environment:
      - DATABASE_URL=postgresql://...
      - INFLUX_URL=http://influxdb:8086

  web:
    build: ./apps/web
    environment:
      - NEXT_PUBLIC_API_URL=https://yourdomain.com
      - NEXT_PUBLIC_MQTT_URL=wss://yourdomain.com:8084

  emqx:
    image: emqx:5
    ports: ["1883:1883", "8083:8083"]
    environment:
      - EMQX_AUTHENTICATION__1__MECHANISM=password_based
      - EMQX_AUTHENTICATION__1__BACKEND=http
      - EMQX_AUTHENTICATION__1__URL=http://api:3001/api/mqtt/auth

  influxdb:
    image: influxdb:2.7
    ports: ["8086:8086"]
    volumes: [influxdb-data:/var/lib/influxdb2]

  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=fitsense
      - POSTGRES_USER=fitsense
      - POSTGRES_PASSWORD=...
    volumes: [postgres-data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine
    volumes: [redis-data:/data]

  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
    depends_on: [influxdb]

volumes:
  influxdb-data:
  postgres-data:
  redis-data:
```

---

## Folder structure

```
fitsense/
├── apps/
│   ├── api/                    # Node.js + Express
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.js
│   │   │   │   ├── clubs.js
│   │   │   │   ├── members.js
│   │   │   │   ├── sessions.js
│   │   │   │   ├── hr.js
│   │   │   │   ├── recommendations.js
│   │   │   │   └── mqtt-webhook.js
│   │   │   ├── services/
│   │   │   │   ├── auth.service.js
│   │   │   │   ├── influx.service.js
│   │   │   │   ├── mqtt.consumer.js
│   │   │   │   └── batch.writer.js
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.js   # JWT verify
│   │   │   │   └── rbac.middleware.js   # role check
│   │   │   └── index.js
│   │   └── Dockerfile
│   │
│   ├── ml/                     # Python + FastAPI
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── anomaly.py
│   │   │   ├── recommendation.py
│   │   │   └── zone.py
│   │   ├── models/
│   │   │   └── hr_analyzer.py
│   │   └── Dockerfile
│   │
│   ├── web/                    # Next.js 14
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/
│   │   │   ├── dashboard/
│   │   │   │   ├── trainer/    # lihat semua member
│   │   │   │   ├── member/     # lihat diri sendiri
│   │   │   │   └── admin/      # super admin
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── HRMonitor.tsx   # komponen real-time mqtt.js
│   │   │   ├── HRZoneBadge.tsx
│   │   │   └── AlertBanner.tsx
│   │   ├── hooks/
│   │   │   └── useMqtt.ts      # hook mqtt.js subscribe
│   │   └── Dockerfile
│   │
│   └── mobile/                 # React Native
│       ├── src/
│       │   ├── ble/            # connect Coospo sensor
│       │   ├── mqtt/           # publish HR data
│       │   └── screens/
│       └── package.json
│
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
└── .env.example
```

---

## Environment variables (.env.example)

```env
# PostgreSQL
DATABASE_URL=postgresql://fitsense:password@postgres:5432/fitsense

# InfluxDB
INFLUX_URL=http://influxdb:8086
INFLUX_TOKEN=your-influx-token
INFLUX_ORG=fitsense
INFLUX_BUCKET=heartrate

# Redis
REDIS_URL=redis://redis:6379

# JWT
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_EXPIRES_IN=7d
MQTT_TOKEN_EXPIRES_IN=30m

# MQTT
MQTT_BROKER_INTERNAL=mqtt://emqx:1883
NEXT_PUBLIC_MQTT_URL=wss://yourdomain.com:8084

# API
API_PORT=3001
NEXT_PUBLIC_API_URL=https://yourdomain.com/api

# ML Service
ML_SERVICE_URL=http://ml:8000
```

---

## Key implementation notes untuk Kiro

1. **Semua query PostgreSQL wajib filter `club_id`** — jangan pernah query lintas club kecuali role `super_admin`
2. **MQTT consumer** subscribe `fitsense/#`, lalu routing berdasarkan topic ke batch writer dan ML anomaly checker secara paralel
3. **MQTT token** di-generate terpisah dari JWT session, scope hanya untuk subscribe sesuai role, expired 30 menit, auto-refresh di frontend
4. **HR zone classifier** dijalankan di API server (bukan ML service) karena logikanya sederhana dan harus real-time tanpa latency tambahan
5. **ML analyze-session** dipanggil oleh API server setelah `POST /api/sessions/end`, secara async (fire and forget), hasilnya ditulis langsung ke PostgreSQL oleh ML service
6. **Batch writer** flush ke InfluxDB setiap 1 detik, buffer di Redis, jangan langsung write per data point
