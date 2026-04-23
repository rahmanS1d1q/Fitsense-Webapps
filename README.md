# FitSense Platform

Platform SaaS multi-tenant untuk monitoring heart rate (HR) secara real-time di gym. Trainer memantau semua member secara live via web dashboard, member memantau diri sendiri via mobile app, dan sistem ML memberikan rekomendasi latihan serta peringatan anomali HR secara otomatis.

---

## Daftar Isi

- [Arsitektur](#arsitektur)
- [Struktur Folder](#struktur-folder)
- [Prasyarat](#prasyarat)
- [Cara Menjalankan](#cara-menjalankan)
- [Endpoint Utama](#endpoint-utama)
- [Menjalankan Test](#menjalankan-test)

---

## Arsitektur

```
Mobile App (React Native)
    │ BLE ← Sensor Coospo HR
    │ MQTT over TLS :8883
    ▼
EMQX Broker ──── Webhook auth/ACL ──── API Server (Node.js :3001)
    │                                       │
    │ Internal subscribe fitsense/#         │── PostgreSQL (data master)
    ▼                                       │── InfluxDB (time-series HR)
API Server                                  │── Redis (buffer + cache)
    │── BatchWriter → InfluxDB              │── ML Service (anomali + rekomendasi)
    └── ML Service → EMQX → alerts

Web Dashboard (Next.js :3000)
    │ MQTT over WSS :8084 (via NGINX)
    ▼
EMQX Broker
```

---

## Struktur Folder

```
fitsense/
│
├── apps/
│   ├── api/                    # API Server — Node.js + Express + TypeScript
│   │   ├── src/
│   │   │   ├── routes/         # Endpoint HTTP (auth, clubs, members, sessions, hr, mqtt, admin)
│   │   │   ├── services/       # Business logic (AuthService, SessionService, BatchWriter, dll)
│   │   │   ├── middleware/     # JWT auth, RBAC, tenant isolation
│   │   │   └── db/             # Koneksi PostgreSQL, Redis, InfluxDB + migrasi
│   │   ├── tests/
│   │   │   ├── unit/           # Unit test per service
│   │   │   ├── property/       # Property-based test (fast-check, 20 properties)
│   │   │   └── integration/    # Integration test (alur data, MQTT auth, tenant isolation)
│   │   ├── migrations/         # File SQL migrasi database
│   │   └── Dockerfile
│   │
│   ├── ml/                     # ML Service — Python + FastAPI
│   │   ├── routers/
│   │   │   ├── anomaly.py      # POST /ml/anomaly-check — deteksi anomali HR real-time
│   │   │   ├── recommendation.py # POST /ml/analyze-session — rekomendasi latihan
│   │   │   └── health.py       # GET /ml/health — status layanan
│   │   ├── services/
│   │   │   ├── zone_state_tracker.py     # Lacak zona HR aktif per member (Redis)
│   │   │   ├── alert_cooldown_manager.py # Cooldown alert per member (Redis)
│   │   │   └── downsampling.py           # Agregasi data HR harian (APScheduler)
│   │   ├── models/
│   │   │   └── hr_analyzer.py  # Pure logic: deteksi anomali + logika rekomendasi
│   │   └── tests/
│   │       ├── unit/           # Unit test (pytest)
│   │       └── property/       # Property-based test (hypothesis)
│   │
│   ├── web/                    # Web Dashboard — Next.js 14 App Router
│   │   ├── app/
│   │   │   ├── (auth)/         # Halaman login, register, forgot/reset password
│   │   │   └── dashboard/      # Dashboard trainer, member, admin
│   │   ├── components/         # HRMonitor, AlertBanner, MemberList, ConnectionStatus, dll
│   │   └── hooks/
│   │       └── useMqtt.ts      # Hook MQTT WebSocket + auto-reconnect + token refresh
│   │
│   └── mobile/                 # Mobile App — React Native
│       └── src/
│           ├── ble/            # BLEManager: scan + koneksi sensor Coospo
│           ├── mqtt/           # MqttPublisher: publish HR ke broker
│           ├── services/       # SessionManager: start/end sesi
│           └── screens/        # LoginScreen, SessionScreen (HR display + alert)
│
├── emqx/
│   ├── emqx.conf               # Konfigurasi EMQX: listener TCP/WS/TLS, auth webhook, ACL webhook
│   └── acl.conf                # Fallback ACL (deny all) jika webhook tidak tersedia
│
├── nginx/
│   └── nginx.conf              # Reverse proxy: :443 → API :3001 | :8084 WSS → EMQX :8083
│
├── grafana/
│   └── provisioning/
│       ├── datasources/
│       │   ├── influxdb.yaml   # Datasource InfluxDB v2 (Flux query)
│       │   └── postgres.yaml   # Datasource PostgreSQL
│       └── dashboards/
│           └── fitsense-overview.json  # Dashboard: HR per club, member aktif, status
│
├── scripts/
│   ├── test-setup.sh           # Spin up test env → migrasi → jalankan semua test → teardown
│   └── db-clean.sh             # Bersihkan data test (TRUNCATE PostgreSQL + FLUSHDB Redis + deleteData InfluxDB)
│
├── docker-compose.yml          # Production: semua service
├── docker-compose.test.yml     # Test: port berbeda (PG :5433, IDB :8087, Redis :6380, EMQX :1884)
├── .env.example                # Template environment variables
└── README.md                   # File ini
```

---

## Prasyarat

| Tool           | Versi minimum | Kegunaan                                      |
| -------------- | ------------- | --------------------------------------------- |
| Docker Desktop | 24+           | Menjalankan PostgreSQL, InfluxDB, Redis, EMQX |
| Node.js        | 18+           | API Server + Web Dashboard                    |
| Python         | 3.10+         | ML Service                                    |
| npm            | 9+            | Package manager Node.js                       |
| pip            | 23+           | Package manager Python                        |

---

## Cara Menjalankan

### Langkah 1 — Siapkan environment variables

```bash
cp .env.example .env
```

Buka `.env` dan ubah nilai berikut:

```env
# Wajib diubah
JWT_SECRET=isi-dengan-string-random-minimal-32-karakter

# Ambil dari InfluxDB UI setelah container jalan (http://localhost:8086)
INFLUX_TOKEN=isi-setelah-influxdb-jalan

# Password untuk koneksi ML Service ke EMQX
ML_MQTT_PASSWORD=password-bebas
```

---

### Langkah 2 — Jalankan infrastruktur

```bash
docker compose up -d postgres influxdb redis emqx
```

Cek status:

```bash
docker compose ps
```

Tunggu semua status `healthy` (~30 detik).

---

### Langkah 3 — Ambil InfluxDB token

Buka `http://localhost:8086`, login dengan:

- Username: `admin`
- Password: `adminpassword`

Pergi ke **Data → API Tokens → Generate All Access Token**, copy tokennya, lalu isi di `.env`:

```env
INFLUX_TOKEN=token-yang-baru-dicopy
```

---

### Langkah 4 — Setup dan jalankan API Server

```bash
cd apps/api
npm install
npm run db:migrate
npm run influx:setup
npm run dev
```

API Server berjalan di `http://localhost:3001`

---

### Langkah 5 — Jalankan ML Service

Buka terminal baru:

```bash
cd apps/ml
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

ML Service berjalan di `http://localhost:8000`

---

### Langkah 6 — Jalankan Web Dashboard

Buka terminal baru:

```bash
cd apps/web
npm install
```

Buat file `.env.local` di dalam `apps/web/`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_MQTT_URL=ws://localhost:8083
```

```bash
npm run dev
```

Web Dashboard berjalan di `http://localhost:3000`

---

### Langkah 7 — Verifikasi semua berjalan

```bash
# API Server health check
curl http://localhost:3001/api/health

# ML Service health check
curl http://localhost:8000/ml/health
```

Kedua endpoint harus mengembalikan `{ "status": "ok" }`.

---

## Test Manual via API

### 1. Daftar club baru

```bash
curl -X POST http://localhost:3001/api/auth/register-club \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gym Test",
    "slug": "gym-test",
    "ownerName": "Admin Gym",
    "ownerEmail": "admin@gymtest.com",
    "ownerPassword": "Password123"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@gymtest.com",
    "password": "Password123"
  }'
```

Simpan nilai `jwt` dari response. Gunakan sebagai `TOKEN` di request berikutnya.

### 3. Buat kode undangan untuk member

```bash
curl -X POST http://localhost:3001/api/clubs/{clubId}/invite \
  -H "Authorization: Bearer TOKEN"
```

### 4. Daftar sebagai member (gunakan kode undangan)

```bash
curl -X POST http://localhost:3001/api/auth/register-member \
  -H "Content-Type: application/json" \
  -d '{
    "code": "kode-undangan-dari-langkah-3",
    "name": "Member Test",
    "email": "member@test.com",
    "password": "Password123"
  }'
```

### 5. Mulai sesi latihan

```bash
curl -X POST http://localhost:3001/api/sessions/start \
  -H "Authorization: Bearer TOKEN_MEMBER"
```

### 6. Lihat daftar member (sebagai trainer/owner)

```bash
curl http://localhost:3001/api/clubs/{clubId}/members \
  -H "Authorization: Bearer TOKEN"
```

---

## Endpoint Utama

| Method | Endpoint                                             | Deskripsi                           |
| ------ | ---------------------------------------------------- | ----------------------------------- |
| POST   | `/api/auth/register-club`                            | Daftar club baru + akun club_owner  |
| POST   | `/api/auth/login`                                    | Login semua role                    |
| POST   | `/api/auth/register-member`                          | Daftar mandiri dengan kode undangan |
| POST   | `/api/auth/forgot-password`                          | Request reset password              |
| POST   | `/api/auth/reset-password`                           | Reset password dengan token         |
| GET    | `/api/clubs`                                         | Daftar semua club (super_admin)     |
| GET    | `/api/clubs/:clubId/members`                         | Daftar member club                  |
| POST   | `/api/clubs/:clubId/invite`                          | Generate kode undangan              |
| POST   | `/api/sessions/start`                                | Mulai sesi latihan                  |
| POST   | `/api/sessions/end`                                  | Akhiri sesi latihan                 |
| GET    | `/api/clubs/:clubId/members/:userId/hr`              | Riwayat HR member                   |
| GET    | `/api/clubs/:clubId/members/:userId/recommendations` | Rekomendasi ML                      |
| GET    | `/api/health`                                        | Health check API Server             |
| GET    | `/ml/health`                                         | Health check ML Service             |
| GET    | `/ml/recommendations/:userId`                        | Rekomendasi dari ML Service         |

---

## Menjalankan Test

### Unit + Property test — API Server

```bash
cd apps/api
npm test
```

### Unit + Property test — ML Service

```bash
cd apps/ml
python -m pytest tests/ -v
```

### Semua test sekaligus (butuh Docker)

```bash
bash scripts/test-setup.sh
```

Script ini akan:

1. Spin up `docker-compose.test.yml` (port terpisah dari production)
2. Jalankan migrasi ke test database
3. Jalankan semua test API Server dan ML Service
4. Tear down container test

---

## Port Referensi

| Service        | Port Development | Port Test |
| -------------- | ---------------- | --------- |
| API Server     | 3001             | 3002      |
| ML Service     | 8000             | 8001      |
| Web Dashboard  | 3000             | —         |
| PostgreSQL     | 5432             | 5433      |
| InfluxDB       | 8086             | 8087      |
| Redis          | 6379             | 6380      |
| EMQX TCP       | 1883             | 1884      |
| EMQX WebSocket | 8083             | 8085      |
| EMQX TLS       | 8883             | —         |
| Grafana        | 3000             | —         |
| InfluxDB UI    | 8086             | —         |

---

## Troubleshooting

**InfluxDB token error**
Ambil token dari InfluxDB UI (`http://localhost:8086`) → Data → API Tokens.

**EMQX webhook gagal (auth denied)**
Pastikan API Server sudah berjalan sebelum EMQX mencoba koneksi. Restart EMQX jika perlu:

```bash
docker compose restart emqx
```

**Port sudah dipakai**

```bash
docker compose ps        # cek container yang jalan
docker compose down      # matikan semua
docker compose up -d ... # jalankan ulang
```

**ML Service import error**

```bash
cd apps/ml
pip install -r requirements.txt
```

**Web Dashboard tidak bisa connect MQTT**
Pastikan `NEXT_PUBLIC_MQTT_URL=ws://localhost:8083` (plain WS untuk development lokal, bukan WSS).
#   F i t s e n s e - W e b a p p s  
 