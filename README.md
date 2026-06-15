# FitSense Platform

> **Platform Monitoring Heart Rate Real-Time Multi-Tenant untuk Gym**  
> Version 2.0 - Januari 2026

Platform SaaS multi-tenant untuk monitoring heart rate (HR) secara real-time di gym. Trainer memantau semua member secara live via web dashboard, dan sistem ML memberikan rekomendasi latihan serta peringatan anomali HR secara otomatis.

Data HR dikirim langsung dari sensor Coospo melalui aplikasi mobile pihak ketiga (bukan bagian dari proyek ini) ke MQTT Broker, kemudian diproses oleh backend platform ini.

**⚡ Highlight Fitur v2.0:**

- ✅ Workout Library & Assignment Management
- ✅ Device Management (Company & Individual)
- ✅ Asset Management (Video/Image untuk Workout)
- ✅ Enhanced RBAC dengan dynamic permissions
- ✅ 235+ automated tests (termasuk 80 property-based tests)
- ✅ Production-ready dengan SSL/TLS support

---

## Daftar Isi

- [Fitur Utama](#fitur-utama)
- [Arsitektur](#arsitektur)
- [Struktur Folder](#struktur-folder)
- [Integrasi Sensor Coospo](#integrasi-sensor-coospo)
- [Prasyarat](#prasyarat)
- [Cara Menjalankan](#cara-menjalankan)
- [Test Manual via API](#test-manual-via-api)
- [Endpoint Utama](#endpoint-utama)
- [Menjalankan Test](#menjalankan-test)
- [Port Referensi](#port-referensi)
- [Troubleshooting](#troubleshooting)
- [Deploy Production](#deploy-ke-server-production)
- [Alur Setup Dashboard Trainer](#alur-setup--dashboard-trainer-bekerja)
- [Skema Database](#skema-database)
- [Changelog](#changelog)
- [Roadmap](#roadmap)
- [FAQ](#faq-frequently-asked-questions)

---

## Fitur Utama

### 🏋️ Workout Management

- **Workout Library**: Kelola library workout dengan video/gambar panduan
- **Asset Management**: Upload dan kelola media untuk workout (video, gambar)
- **Workout Assignment**: Assign workout ke member tertentu dengan tanggal dan status tracking
- **Assignment Tracking**: Monitor progress member dalam menyelesaikan workout yang di-assign

### 📱 Device Management

- **Company Devices**: Kelola sensor HR milik gym yang bisa dipinjamkan ke member
- **Individual Devices**: Member bisa registrasi sensor pribadi
- **Device Status**: Track status device (available, borrowed, maintenance, lost)
- **Auto Device Resolution**: Sistem otomatis mengidentifikasi device dari MAC address saat sesi dimulai

### 👥 Multi-Tenant & RBAC

- **Isolasi Company**: Setiap gym terisolasi penuh (data, member, device)
- **Role-Based Access**: 4 role dengan hak akses berbeda (super_admin, club_owner, trainer, member)
- **Dynamic Permissions**: Satu user bisa punya role berbeda di company berbeda

### 💓 Real-Time HR Monitoring

- **Live Dashboard**: Trainer monitor HR semua member secara real-time (< 1 detik latency)
- **HR Zone Classification**: Otomatis klasifikasi zona HR (rest, fat_burn, cardio, aerobic, peak)
- **WebSocket MQTT**: Koneksi real-time via MQTT over WebSocket dengan auto-reconnect

### 🤖 ML-Powered Insights

- **Anomaly Detection**: Deteksi otomatis kondisi berbahaya (HR > 95% Max_HR)
- **Smart Alerts**: Warning untuk HR abnormal dengan cooldown cerdas
- **Workout Recommendations**: Rekomendasi latihan berdasarkan riwayat HR member

### 🔐 Security & Compliance

- **JWT Authentication**: Token expiry 7 hari dengan refresh mechanism
- **MQTT Token**: Token terpisah untuk MQTT (30 menit, auto-refresh)
- **Rate Limiting**: Proteksi brute force login dan reset password
- **Webhook ACL**: EMQX validate setiap publish/subscribe via API webhook

### 📊 Data Management

- **Time-Series Optimization**: InfluxDB untuk data HR raw (90 hari) dan agregasi (2 tahun)
- **Batch Writing**: Redis buffer untuk efisiensi write ke InfluxDB
- **Orphan Session Detection**: Auto-close sesi yang tidak ada data HR > 30 menit
- **Downsampling**: Agregasi otomatis data HR harian untuk long-term storage

---

## Arsitektur

```
Sensor Coospo HR
    │ BLE
    ▼
Aplikasi Mobile Coospo (pihak ketiga — bukan bagian proyek ini)
    │ MQTT over TCP :1883 atau TLS :8883
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

> **Catatan:** Aplikasi mobile tidak dibuat dalam proyek ini. Sensor Coospo menggunakan aplikasi bawaan atau aplikasi pihak ketiga yang dikonfigurasi untuk mengirim data HR ke MQTT Broker platform ini.

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
│   └── web/                    # Web Dashboard — Next.js 14 App Router
│       ├── app/
│       │   ├── (auth)/         # Halaman login, register, forgot/reset password
│       │   └── dashboard/      # Dashboard trainer, member, admin
│       ├── components/         # HRMonitor, AlertBanner, MemberList, ConnectionStatus, dll
│       └── hooks/
│           └── useMqtt.ts      # Hook MQTT WebSocket + auto-reconnect + token refresh
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

> **Catatan:** Folder `apps/mobile/` tidak ada — aplikasi mobile tidak dibuat dalam proyek ini. Sensor Coospo menggunakan aplikasi pihak ketiga yang dikonfigurasi untuk terhubung ke MQTT Broker platform ini.

---

## Integrasi Sensor Coospo

Sensor Coospo mengirim data HR melalui aplikasi mobile pihak ketiga. Untuk terhubung ke platform FitSense, konfigurasi aplikasi tersebut dengan:

| Parameter | Nilai                                             |
| --------- | ------------------------------------------------- |
| MQTT Host | IP server atau domain (contoh: `yourdomain.com`)  |
| MQTT Port | `1883` (tanpa TLS) atau `8883` (dengan TLS)       |
| Username  | MQTT_Token member (didapat setelah login via API) |
| Password  | MQTT_Token member (sama dengan username)          |
| Topic     | `fitsense/{clubId}/{userId}/hr`                   |

### Format payload yang harus dikirim

```json
{
  "hr": 120,
  "session_id": "uuid-sesi-aktif",
  "timestamp": 1700000000000,
  "rr": 800
}
```

| Field        | Tipe          | Wajib | Keterangan                      |
| ------------ | ------------- | ----- | ------------------------------- |
| `hr`         | integer       | Ya    | Heart rate dalam bpm (20–300)   |
| `session_id` | string (UUID) | Ya    | ID sesi yang sedang aktif       |
| `timestamp`  | integer       | Ya    | Unix timestamp dalam milidetik  |
| `rr`         | float         | Tidak | RR interval dalam ms (200–2000) |

### Cara mendapatkan MQTT_Token

```bash
# Login member via API
POST http://localhost:3001/api/auth/login
Body: { "email": "member@gym.com", "password": "Password123" }

# Response berisi mqttToken — gunakan sebagai username dan password MQTT
```

### Cara mendapatkan session_id

```bash
# Mulai sesi latihan
POST http://localhost:3001/api/sessions/start
Headers: Authorization: Bearer {jwt}

# Response berisi session.id — gunakan sebagai session_id di payload MQTT
```

---

## Prasyarat (Development Lokal)

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

Simpan `clubId` dan `jwt` dari response.

---

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

---

### 3. Buat kode undangan untuk member

```bash
curl -X POST http://localhost:3001/api/companies/{clubId}/invite \
  -H "Authorization: Bearer TOKEN"
```

Simpan `code` dari response.

---

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

Simpan `jwt` dan `mqttToken` dari response.

---

### 5. Upload asset untuk workout

```bash
curl -X POST http://localhost:3001/api/companies/{clubId}/assets \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@/path/to/video.mp4" \
  -F "type=workout_video"
```

Simpan `asset.id` dari response.

---

### 6. Buat workout baru

```bash
curl -X POST http://localhost:3001/api/companies/{clubId}/workouts \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "HIIT Cardio 30 Min",
    "asset_id": "asset-id-dari-langkah-5",
    "intro_activities": "Warm up 5 menit, lalu 20 menit interval, cool down 5 menit",
    "intro_duration": 1800
  }'
```

Simpan `workout.id` dari response.

---

### 7. Assign workout ke member

```bash
curl -X POST http://localhost:3001/api/companies/{clubId}/workout-assignments \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workout_id": "workout-id-dari-langkah-6",
    "member_id": "member-id",
    "assigned_date": "2024-02-01",
    "deadline": "2024-02-07",
    "notes": "Fokus di cardio zone, jaga HR 60-70%"
  }'
```

---

### 8. Registrasi device company

```bash
curl -X POST http://localhost:3001/api/companies/{clubId}/devices \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coospo Sensor #01",
    "device_type": "coospo_hw706",
    "mac_address": "AA:BB:CC:DD:EE:01"
  }'
```

---

### 9. Registrasi device pribadi member

Login sebagai member dulu, lalu:

```bash
curl -X POST http://localhost:3001/api/companies/{clubId}/members/{memberId}/devices \
  -H "Authorization: Bearer TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d '{
    "device_type": "coospo_hw706",
    "mac_address": "AA:BB:CC:DD:EE:FF",
    "name": "Sensor Pribadi Saya"
  }'
```

---

### 10. Mulai sesi latihan

```bash
curl -X POST http://localhost:3001/api/sessions/start \
  -H "Authorization: Bearer TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d '{
    "workout_id": "workout-id-opsional"
  }'
```

Simpan `session.id` dari response.

---

### 11. Lihat assignment member

```bash
curl http://localhost:3001/api/companies/{clubId}/members/{memberId}/workout-assignments \
  -H "Authorization: Bearer TOKEN_MEMBER"
```

---

### 12. Mark assignment as completed

```bash
curl -X PATCH http://localhost:3001/api/companies/{clubId}/workout-assignments/{assignmentId}/status \
  -H "Authorization: Bearer TOKEN_MEMBER" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

---

### 13. Lihat daftar member (sebagai trainer/owner)

```bash
curl http://localhost:3001/api/companies/{clubId}/members \
  -H "Authorization: Bearer TOKEN"
```

---

## Endpoint Utama

### Authentication

| Method | Endpoint                    | Deskripsi                           | Role Required |
| ------ | --------------------------- | ----------------------------------- | ------------- |
| POST   | `/api/auth/register-club`   | Daftar club baru + akun club_owner  | Public        |
| POST   | `/api/auth/login`           | Login semua role                    | Public        |
| POST   | `/api/auth/register-member` | Daftar mandiri dengan kode undangan | Public        |
| POST   | `/api/auth/forgot-password` | Request reset password              | Public        |
| POST   | `/api/auth/reset-password`  | Reset password dengan token         | Public        |
| POST   | `/api/auth/refresh`         | Refresh JWT token                   | Authenticated |

### Companies (Clubs)

| Method | Endpoint                          | Deskripsi         | Role Required       |
| ------ | --------------------------------- | ----------------- | ------------------- |
| GET    | `/api/companies`                  | Daftar semua club | super_admin         |
| GET    | `/api/companies/:companyId`       | Detail club       | club_owner          |
| PATCH  | `/api/companies/:companyId`       | Update info club  | club_owner          |
| GET    | `/api/companies/:companyId/stats` | Statistik club    | club_owner, trainer |

### Members

| Method | Endpoint                                | Deskripsi             | Role Required       |
| ------ | --------------------------------------- | --------------------- | ------------------- |
| GET    | `/api/companies/:companyId/members`     | Daftar member club    | club_owner, trainer |
| POST   | `/api/companies/:companyId/members`     | Tambah member/trainer | club_owner          |
| GET    | `/api/companies/:companyId/members/:id` | Detail member         | club_owner, trainer |
| PATCH  | `/api/companies/:companyId/members/:id` | Update member         | club_owner, member  |
| DELETE | `/api/companies/:companyId/members/:id` | Hapus member          | club_owner          |

### Invitations

| Method | Endpoint                            | Deskripsi              | Role Required       |
| ------ | ----------------------------------- | ---------------------- | ------------------- |
| POST   | `/api/companies/:companyId/invite`  | Generate kode undangan | club_owner, trainer |
| GET    | `/api/companies/:companyId/invites` | Daftar kode undangan   | club_owner, trainer |
| DELETE | `/api/companies/:companyId/invites` | Hapus kode undangan    | club_owner          |

### Devices

| Method | Endpoint                                                   | Deskripsi                        | Role Required       |
| ------ | ---------------------------------------------------------- | -------------------------------- | ------------------- |
| POST   | `/api/companies/:companyId/devices`                        | Tambah device company            | club_owner          |
| GET    | `/api/companies/:companyId/devices`                        | Daftar device company            | club_owner, trainer |
| GET    | `/api/companies/:companyId/devices/:deviceId`              | Detail device company            | club_owner, trainer |
| PATCH  | `/api/companies/:companyId/devices/:deviceId`              | Update info device               | club_owner          |
| PATCH  | `/api/companies/:companyId/devices/:deviceId/status`       | Update status device             | club_owner          |
| DELETE | `/api/companies/:companyId/devices/:deviceId`              | Hapus device company             | club_owner          |
| POST   | `/api/companies/:companyId/members/:userId/devices`        | Registrasi device pribadi member | member, club_owner  |
| GET    | `/api/companies/:companyId/members/:userId/devices`        | Daftar device pribadi member     | member, club_owner  |
| DELETE | `/api/companies/:companyId/members/:userId/devices/:devId` | Hapus device pribadi             | member, club_owner  |

### Assets

| Method | Endpoint                               | Deskripsi           | Role Required       |
| ------ | -------------------------------------- | ------------------- | ------------------- |
| POST   | `/api/companies/:companyId/assets`     | Upload asset (file) | club_owner, trainer |
| GET    | `/api/companies/:companyId/assets`     | Daftar asset        | club_owner, trainer |
| GET    | `/api/companies/:companyId/assets/:id` | Detail asset        | club_owner, trainer |
| PATCH  | `/api/companies/:companyId/assets/:id` | Update asset        | club_owner, trainer |
| DELETE | `/api/companies/:companyId/assets/:id` | Hapus asset         | club_owner          |

### Workouts

| Method | Endpoint                                 | Deskripsi      | Role Required       |
| ------ | ---------------------------------------- | -------------- | ------------------- |
| POST   | `/api/companies/:companyId/workouts`     | Tambah workout | club_owner, trainer |
| GET    | `/api/companies/:companyId/workouts`     | Daftar workout | club_owner, trainer |
| GET    | `/api/companies/:companyId/workouts/:id` | Detail workout | All authenticated   |
| PATCH  | `/api/companies/:companyId/workouts/:id` | Update workout | club_owner, trainer |
| DELETE | `/api/companies/:companyId/workouts/:id` | Hapus workout  | club_owner          |

### Workout Assignments

| Method | Endpoint                                                        | Deskripsi                            | Role Required       |
| ------ | --------------------------------------------------------------- | ------------------------------------ | ------------------- |
| POST   | `/api/companies/:companyId/workout-assignments`                 | Assign workout ke member             | club_owner, trainer |
| GET    | `/api/companies/:companyId/workout-assignments`                 | Daftar assignment (filter by member) | club_owner, trainer |
| GET    | `/api/companies/:companyId/workout-assignments/:id`             | Detail assignment                    | All authenticated   |
| PATCH  | `/api/companies/:companyId/workout-assignments/:id`             | Update assignment (notes, deadline)  | club_owner, trainer |
| PATCH  | `/api/companies/:companyId/workout-assignments/:id/status`      | Update status (member complete)      | member              |
| DELETE | `/api/companies/:companyId/workout-assignments/:id`             | Hapus assignment                     | club_owner, trainer |
| GET    | `/api/companies/:companyId/members/:userId/workout-assignments` | Daftar assignment member             | member, trainer     |

### Sessions

| Method | Endpoint                                             | Deskripsi           | Role Required      |
| ------ | ---------------------------------------------------- | ------------------- | ------------------ |
| POST   | `/api/sessions/start`                                | Mulai sesi latihan  | member             |
| POST   | `/api/sessions/end`                                  | Akhiri sesi latihan | member             |
| GET    | `/api/companies/:companyId/sessions`                 | Daftar sesi club    | club_owner,trainer |
| GET    | `/api/companies/:companyId/members/:userId/sessions` | Riwayat sesi member | member, trainer    |

### Heart Rate Data

| Method | Endpoint                                       | Deskripsi         | Role Required   |
| ------ | ---------------------------------------------- | ----------------- | --------------- |
| GET    | `/api/companies/:companyId/members/:userId/hr` | Riwayat HR member | member, trainer |
| GET    | `/api/sessions/:sessionId/hr`                  | Data HR per sesi  | member, trainer |

### ML Recommendations

| Method | Endpoint                                                    | Deskripsi                | Role Required   |
| ------ | ----------------------------------------------------------- | ------------------------ | --------------- |
| GET    | `/api/companies/:companyId/members/:userId/recommendations` | Rekomendasi ML           | member, trainer |
| GET    | `/ml/recommendations/:userId`                               | Rekomendasi ML (direct)  | Internal        |
| POST   | `/ml/anomaly-check`                                         | Cek anomali HR real-time | Internal        |
| POST   | `/ml/analyze-session`                                       | Analisis sesi selesai    | Internal        |

### Health Check

| Method | Endpoint      | Deskripsi               | Role Required |
| ------ | ------------- | ----------------------- | ------------- |
| GET    | `/api/health` | Health check API Server | Public        |
| GET    | `/ml/health`  | Health check ML Service | Public        |

### MQTT Webhooks (Internal)

| Method | Endpoint         | Deskripsi         | Role Required |
| ------ | ---------------- | ----------------- | ------------- |
| POST   | `/api/mqtt/auth` | EMQX auth webhook | EMQX only     |
| POST   | `/api/mqtt/acl`  | EMQX ACL webhook  | EMQX only     |

---

## Menjalankan Test

### Unit + Property test — API Server

```bash
cd apps/api
npm test
```

**Test Coverage (API Server)**:

- 190 tests total (29 test suites)
- 125 unit tests (services, middleware, utilities)
- 65 property-based tests (fast-check, 100+ iterations each)
- 4 integration tests (end-to-end flows)

**Property Test Categories**:

- Authentication & Security (7 properties): password validation, token generation, rate limiting, anti-enumeration
- MQTT & Devices (5 properties): MQTT ACL, payload validation, device type validation
- HR Data & Zones (4 properties): HR history queries, zone classification
- Invitations (2 properties): single-use enforcement, expiration
- Password Reset (2 properties): token single-use, expiration

---

### Unit + Property test — ML Service

```bash
cd apps/ml
python -m pytest tests/ -v
```

**Test Coverage (ML Service)**:

- 45 tests total
- 30 unit tests (routers, services, models)
- 15 property-based tests (hypothesis, 100+ examples each)

**Property Test Categories**:

- Anomaly Detection (5 properties): HR threshold validation, zone transition logic
- Recommendation Engine (4 properties): intensity calculation, workout suggestions
- Zone State Tracking (3 properties): Redis state consistency
- Alert Cooldown (3 properties): Cooldown timing enforcement

---

### Semua test sekaligus (butuh Docker)

```bash
bash scripts/test-setup.sh
```

Script ini akan:

1. Spin up `docker-compose.test.yml` (port terpisah dari production)
2. Jalankan migrasi ke test database
3. Jalankan semua test API Server dan ML Service secara paralel
4. Generate coverage report
5. Tear down container test

**Total Test Suite**:

- **235 automated tests** across all services
- **80 property-based tests** with 100+ iterations each
- **Coverage**: 85%+ untuk business logic critical

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

---

## Deploy ke Server Production

### Prasyarat Server

- Ubuntu 22.04 / Debian 12 (atau distro Linux lainnya)
- Docker Engine 24+ dan Docker Compose v2
- Domain yang sudah diarahkan ke IP server
- Sertifikat SSL (Let's Encrypt direkomendasikan)

---

### Langkah 1 — Install Docker di server

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

---

### Langkah 2 — Clone repo ke server

```bash
git clone https://github.com/username/fitsense.git
cd fitsense
```

---

### Langkah 3 — Siapkan SSL certificate (Let's Encrypt)

```bash
sudo apt install certbot -y
sudo certbot certonly --standalone -d yourdomain.com
```

Sertifikat tersimpan di `/etc/letsencrypt/live/yourdomain.com/`.

Salin ke folder nginx:

```bash
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem nginx/ssl/key.pem
sudo chmod 644 nginx/ssl/cert.pem nginx/ssl/key.pem
```

---

### Langkah 4 — Buat file `.env` production

```bash
cp .env.example .env
nano .env
```

Ubah semua nilai berikut:

```env
# Database — password kuat
DATABASE_URL=postgresql://fitsense:PASSWORD_KUAT@postgres:5432/fitsense

# InfluxDB — token panjang dan random
INFLUX_TOKEN=token-production-random-panjang

# JWT — WAJIB diganti, minimal 32 karakter
JWT_SECRET=string-random-sangat-panjang-tidak-bisa-ditebak

# MQTT ML Service
ML_MQTT_PASSWORD=password-kuat-ml-service

# Email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email@domain.com
SMTP_PASS=app-password-gmail

# Domain production
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
NEXT_PUBLIC_MQTT_URL=wss://yourdomain.com:8084
APP_DOMAIN=yourdomain.com
```

---

### Langkah 5 — Update `emqx/emqx.conf`

Ganti `host.docker.internal` (khusus Docker Desktop) ke nama service Docker:

```bash
sed -i 's/host.docker.internal/api/g' emqx/emqx.conf
```

Atau edit manual — ganti dua baris URL webhook:

```
url = "http://api:3001/api/mqtt/auth"
url = "http://api:3001/api/mqtt/acl"
```

---

### Langkah 6 — Update CORS di API Server

Edit `apps/api/src/app.ts`, ganti origin:

```typescript
app.use(
  cors({
    origin: ["https://yourdomain.com"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
```

---

### Langkah 7 — Update `nginx/nginx.conf` untuk SSL

```nginx
events {
    worker_connections 1024;
}

http {
    server {
        listen 443 ssl;
        server_name yourdomain.com;

        ssl_certificate     /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        location / {
            proxy_pass http://api:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}

stream {
    server {
        listen 8084 ssl;
        ssl_certificate     /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        proxy_pass emqx:8083;
    }
}
```

---

### Langkah 8 — Update `docker-compose.yml` untuk production

Aktifkan kembali port EMQX TLS dan mount SSL nginx:

```yaml
nginx:
  volumes:
    - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    - ./nginx/ssl:/etc/nginx/ssl:ro # tambahkan ini

emqx:
  ports:
    - "1883:1883"
    - "8083:8083"
    - "8883:8883" # aktifkan untuk Mobile App TLS
```

---

### Langkah 9 — Build dan jalankan semua service

```bash
docker compose up -d --build
```

---

### Langkah 10 — Jalankan migrasi database

```bash
docker compose exec api npm run db:migrate
docker compose exec api npm run influx:setup
```

---

### Langkah 11 — Buat akun super admin

```bash
docker compose exec api node -e "
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const hash = bcrypt.hashSync('GantiPasswordIni123', 10);
pool.query(
  \"INSERT INTO users (club_id, name, email, password_hash, role, status) VALUES (NULL, 'Super Admin', 'admin@yourdomain.com', '\$1', 'super_admin', 'active') ON CONFLICT (email) DO NOTHING\",
  [hash]
).then(() => { console.log('Super admin created'); pool.end(); });
"
```

---

### Langkah 12 — Verifikasi

```bash
# Cek semua container jalan
docker compose ps

# Cek API
curl https://yourdomain.com/api/health

# Cek ML Service (internal)
docker compose exec ml curl http://localhost:8000/ml/health
```

---

### Checklist Production

| Item             | File                          | Perubahan                      |
| ---------------- | ----------------------------- | ------------------------------ |
| JWT secret       | `.env`                        | String random 64+ karakter     |
| InfluxDB token   | `.env`                        | Token production               |
| DB password      | `.env` + `docker-compose.yml` | Password kuat                  |
| SMTP             | `.env`                        | Email provider asli            |
| Domain URL       | `.env`                        | Domain asli                    |
| EMQX webhook URL | `emqx/emqx.conf`              | `host.docker.internal` → `api` |
| CORS origin      | `apps/api/src/app.ts`         | Domain asli                    |
| SSL certificate  | `nginx/ssl/`                  | Sertifikat Let's Encrypt       |
| NGINX config     | `nginx/nginx.conf`            | Path SSL + domain              |

---

### Perpanjang SSL otomatis (crontab)

```bash
sudo crontab -e
```

Tambahkan:

```
0 3 * * * certbot renew --quiet && cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /path/to/fitsense/nginx/ssl/cert.pem && cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /path/to/fitsense/nginx/ssl/key.pem && docker compose -f /path/to/fitsense/docker-compose.yml restart nginx
```

---

## Alur Setup → Dashboard Trainer Bekerja

### Fase 1: Jalankan Semua Service

```bash
# Terminal 1 — Infrastruktur
docker compose up -d postgres influxdb redis emqx

# Terminal 2 — API Server
cd apps/api && npm install && npm run db:migrate && npm run influx:setup && npm run dev

# Terminal 3 — ML Service
cd apps/ml && pip install -r requirements.txt && uvicorn main:app --reload --port 8000

# Terminal 4 — Web Dashboard
cd apps/web && npm install && npm run dev
```

---

### Fase 2: Buat Club dan Akun

**Step 1 — Daftar club baru (via terminal/Postman):**

```bash
curl -X POST http://localhost:3001/api/auth/register-club \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Gym Test",
    "slug": "gym-test",
    "ownerName": "Pemilik Gym",
    "ownerEmail": "owner@gym.com",
    "ownerPassword": "Password123"
  }'
```

Simpan `clubId` dari response.

**Step 2 — Login sebagai club_owner:**

```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@gym.com","password":"Password123"}'
```

Simpan `jwt` dari response.

**Step 3 — Buat akun trainer:**

```bash
curl -X POST http://localhost:3001/api/clubs/{clubId}/members \
  -H "Authorization: Bearer {jwt}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trainer Test",
    "email": "trainer@gym.com",
    "password": "Password123",
    "role": "trainer"
  }'
```

**Step 4 — Buat akun member:**

```bash
curl -X POST http://localhost:3001/api/clubs/{clubId}/members \
  -H "Authorization: Bearer {jwt}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Member Test",
    "email": "member@gym.com",
    "password": "Password123",
    "role": "member"
  }'
```

Simpan `userId` member dari response.

---

### Fase 3: Login Trainer ke Dashboard

1. Buka `http://localhost:3000/login`
2. Login dengan `trainer@gym.com` / `Password123`
3. Otomatis redirect ke `/dashboard/trainer`
4. Status koneksi MQTT tampil di pojok kanan atas (kuning = menyambung, hijau = terhubung)

---

### Fase 4: Simulasi Data HR Member (tanpa sensor fisik)

**Step 1 — Login sebagai member dan mulai sesi:**

```bash
# Login member
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@gym.com","password":"Password123"}'
# Simpan jwt member dan mqttToken

# Mulai sesi
curl -X POST http://localhost:3001/api/sessions/start \
  -H "Authorization: Bearer {jwt_member}"
# Simpan sessionId
```

**Step 2 — Publish data HR ke EMQX (simulasi sensor):**

Gunakan **MQTT Explorer** (download di mqtt-explorer.com) dengan konfigurasi:

- Host: `localhost`
- Port: `1883`
- Username: `{mqttToken}` (dari response login)
- Password: `{mqttToken}`

Publish ke topic `fitsense/{clubId}/{userId}/hr` dengan payload:

```json
{
  "hr": 120,
  "session_id": "{sessionId}",
  "timestamp": 1700000000000
}
```

Atau via terminal dengan mosquitto:

```bash
mosquitto_pub -h localhost -p 1883 \
  -u "{mqttToken}" -P "{mqttToken}" \
  -t "fitsense/{clubId}/{userId}/hr" \
  -m '{"hr":120,"session_id":"{sessionId}","timestamp":1700000000000}'
```

---

### Fase 5: Dashboard Trainer Menerima Data Real-Time

Setelah data HR dipublish, dashboard trainer akan:

- Menampilkan nama member + nilai HR terkini
- Menampilkan badge zona HR (warna sesuai intensitas)
- Menampilkan alert merah jika HR > 95% Max_HR (CRITICAL)
- Menampilkan alert kuning jika HR > 85% selama > 10 menit (WARNING)

---

### Ringkasan Alur Data

```
Sensor / Simulasi
    │ MQTT publish fitsense/{clubId}/{userId}/hr
    ▼
EMQX Broker
    │ forward ke subscriber
    ▼
API Server (MqttConsumer)
    ├── BatchWriter → InfluxDB (simpan data)
    └── ML Service → cek anomali
            │ jika anomali → publish ke fitsense/{clubId}/{userId}/alerts
            ▼
Web Dashboard Trainer
    └── update HR real-time + tampilkan alert ✓
```

---

### Tools yang Berguna untuk Testing

| Tool               | Kegunaan                      | Link                  |
| ------------------ | ----------------------------- | --------------------- |
| **Postman**        | Test REST API dengan GUI      | postman.com           |
| **MQTT Explorer**  | Publish/subscribe MQTT manual | mqtt-explorer.com     |
| **Thunder Client** | Extension VS Code untuk API   | VS Code marketplace   |
| **InfluxDB UI**    | Lihat data HR yang tersimpan  | http://localhost:8086 |

---

## Skema Database

### PostgreSQL — Relasi Antar Tabel

```
companies
  ├── assets (company_id → companies.id)
  ├── workouts (company_id → companies.id, asset_id → assets.id)
  ├── users_companies (company_id → companies.id, user_id → users.id)
  └── invite_codes (company_id → companies.id)

users
  ├── users_companies (user_id → users.id)
  ├── sessions (user_id → users.id)
  │     ├── ml_recommendations (session_id → sessions.id)
  │     └── heart_rate (session_id → sessions.id)
  ├── devices (user_id → users.id)
  └── password_reset_tokens (user_id → users.id)
```

---

### Tabel `companies` _(rename dari `clubs`)_

| Kolom        | Tipe         | Keterangan                         |
| ------------ | ------------ | ---------------------------------- |
| `id`         | UUID         | Primary key                        |
| `name`       | VARCHAR(100) | Nama gym                           |
| `slug`       | VARCHAR(50)  | URL-friendly name, unik            |
| `address`    | TEXT         | Alamat                             |
| `phone`      | VARCHAR(20)  | Nomor telepon                      |
| `status`     | VARCHAR(20)  | `active` / `suspended`             |
| `asset_id`   | UUID         | FK → assets.id (logo/banner, null) |
| `created_at` | TIMESTAMPTZ  | Waktu dibuat                       |
| `updated_at` | TIMESTAMPTZ  | Waktu diupdate                     |

---

### Tabel `users` _(dimodifikasi)_

| Kolom           | Tipe         | Keterangan                                         |
| --------------- | ------------ | -------------------------------------------------- |
| `id`            | UUID         | Primary key                                        |
| `first_name`    | VARCHAR(100) | Nama depan                                         |
| `last_name`     | VARCHAR(100) | Nama belakang                                      |
| `email`         | VARCHAR(150) | Email unik global                                  |
| `password_hash` | TEXT         | bcrypt hash                                        |
| `role`          | VARCHAR(20)  | Hanya `super_admin` (role lain di users_companies) |
| `bio_code`      | VARCHAR(100) | Kode bio member                                    |
| `age`           | INTEGER      | Usia (untuk kalkulasi Max_HR = 220 - usia)         |
| `gender`        | VARCHAR(10)  | Jenis kelamin                                      |
| `height`        | FLOAT        | Tinggi badan (cm)                                  |
| `weight`        | FLOAT        | Berat badan (kg)                                   |
| `status`        | VARCHAR(20)  | `active` / `inactive`                              |
| `created_at`    | TIMESTAMPTZ  | Waktu dibuat                                       |

---

### Tabel `users_companies` _(baru — RBAC)_

| Kolom        | Tipe        | Keterangan                          |
| ------------ | ----------- | ----------------------------------- |
| `id`         | UUID        | Primary key                         |
| `user_id`    | UUID        | FK → users.id                       |
| `company_id` | UUID        | FK → companies.id                   |
| `role`       | VARCHAR(20) | `club_owner` / `trainer` / `member` |
| `created_at` | TIMESTAMPTZ | Waktu dibuat                        |

> Satu user bisa punya role berbeda di company yang berbeda. UNIQUE(user_id, company_id).

---

### Tabel `assets` _(baru)_

| Kolom        | Tipe         | Keterangan                                                          |
| ------------ | ------------ | ------------------------------------------------------------------- |
| `id`         | UUID         | Primary key                                                         |
| `company_id` | UUID         | FK → companies.id                                                   |
| `name`       | VARCHAR(255) | Nama asset                                                          |
| `size`       | VARCHAR(50)  | Ukuran file                                                         |
| `type`       | VARCHAR(50)  | `profile_photo` / `workout_video` / `workout_image` / `club_banner` |
| `url`        | TEXT         | URL asset                                                           |
| `published`  | BOOLEAN      | Status publikasi                                                    |
| `created_at` | TIMESTAMPTZ  | Waktu dibuat                                                        |
| `updated_at` | TIMESTAMPTZ  | Waktu diupdate                                                      |

---

### Tabel `workouts` _(baru)_

| Kolom              | Tipe         | Keterangan                    |
| ------------------ | ------------ | ----------------------------- |
| `id`               | UUID         | Primary key                   |
| `asset_id`         | UUID         | FK → assets.id (video/gambar) |
| `company_id`       | UUID         | FK → companies.id             |
| `name`             | VARCHAR(255) | Nama workout                  |
| `intro_activities` | TEXT         | Deskripsi aktivitas intro     |
| `intro_duration`   | INTEGER      | Durasi intro (detik)          |
| `created_at`       | TIMESTAMPTZ  | Waktu dibuat                  |
| `updated_at`       | TIMESTAMPTZ  | Waktu diupdate                |

---

### Tabel `sessions` _(dimodifikasi)_

| Kolom              | Tipe        | Keterangan                                  |
| ------------------ | ----------- | ------------------------------------------- |
| `id`               | UUID        | Primary key                                 |
| `user_id`          | UUID        | FK → users.id                               |
| `company_id`       | UUID        | FK → companies.id _(rename dari club_id)_   |
| `workout_id`       | UUID        | FK → workouts.id (nullable)                 |
| `started_at`       | TIMESTAMPTZ | Waktu mulai sesi                            |
| `ended_at`         | TIMESTAMPTZ | Waktu selesai (null = masih aktif)          |
| `avg_hr`           | INTEGER     | Rata-rata HR sesi                           |
| `max_hr`           | INTEGER     | HR tertinggi sesi                           |
| `min_hr`           | INTEGER     | HR terendah sesi                            |
| `duration_minutes` | INTEGER     | Durasi dalam menit                          |
| `hr_zone`          | VARCHAR(20) | Zona HR dominan                             |
| `mood`             | VARCHAR(50) | Perasaan member sebelum/sesudah latihan     |
| `auto_closed`      | BOOLEAN     | True jika ditutup otomatis (orphan session) |
| `created_at`       | TIMESTAMPTZ | Waktu dibuat                                |

---

### Tabel `heart_rate` _(baru — summary PostgreSQL)_

| Kolom        | Tipe        | Keterangan       |
| ------------ | ----------- | ---------------- |
| `id`         | UUID        | Primary key      |
| `session_id` | UUID        | FK → sessions.id |
| `timestamp`  | TIMESTAMPTZ | Waktu pengukuran |
| `value`      | FLOAT       | Nilai HR (bpm)   |

> Raw data HR per detik tetap di InfluxDB. Tabel ini hanya untuk summary/snapshot per sesi.

---

### Tabel `workout_assignments` _(baru)_

| Kolom           | Tipe        | Keterangan                                |
| --------------- | ----------- | ----------------------------------------- |
| `id`            | UUID        | Primary key                               |
| `workout_id`    | UUID        | FK → workouts.id                          |
| `member_id`     | UUID        | FK → users.id (member yang di-assign)     |
| `company_id`    | UUID        | FK → companies.id                         |
| `assigned_by`   | UUID        | FK → users.id (trainer/owner yang assign) |
| `assigned_date` | DATE        | Tanggal assignment                        |
| `deadline`      | DATE        | Deadline (nullable)                       |
| `status`        | VARCHAR(20) | `assigned` / `in_progress` / `completed`  |
| `completed_at`  | TIMESTAMPTZ | Waktu member mark as completed            |
| `notes`         | TEXT        | Catatan tambahan dari trainer             |
| `created_at`    | TIMESTAMPTZ | Waktu dibuat                              |
| `updated_at`    | TIMESTAMPTZ | Waktu diupdate                            |

---

### Tabel `devices` _(dimodifikasi — tambah kolom baru)_

| Kolom           | Tipe         | Keterangan                                                    |
| --------------- | ------------ | ------------------------------------------------------------- |
| `id`            | UUID         | Primary key                                                   |
| `user_id`       | UUID         | FK → users.id (null untuk company device)                     |
| `company_id`    | UUID         | FK → companies.id                                             |
| `device_type`   | VARCHAR(50)  | `coospo_hw706` (satu-satunya tipe yang valid)                 |
| `mac_address`   | VARCHAR(20)  | MAC address sensor, unik per user/company                     |
| `owner_type`    | VARCHAR(20)  | `company` / `individual`                                      |
| `name`          | VARCHAR(255) | Nama device (nullable)                                        |
| `status`        | VARCHAR(20)  | `available` / `borrowed` / `maintenance` / `lost`             |
| `assigned_to`   | UUID         | FK → users.id (member yang meminjam company device, nullable) |
| `registered_by` | UUID         | FK → users.id (yang registrasi device)                        |
| `notes`         | TEXT         | Catatan tambahan                                              |
| `registered_at` | TIMESTAMPTZ  | Waktu registrasi                                              |
| `updated_at`    | TIMESTAMPTZ  | Waktu diupdate                                                |

**Logika Device Resolution**:

- Saat member mulai sesi dan publish HR dengan MAC address, sistem auto-resolve:
  1. Cek individual device milik member tersebut (match `user_id` + `mac_address`)
  2. Jika tidak ketemu, cek company device (match `company_id` + `mac_address`)
  3. Company device yang ketemu otomatis status jadi `borrowed` dan `assigned_to` di-set ke member

---

### Tabel `ml_recommendations` _(tidak berubah)_

| Kolom          | Tipe        | Keterangan                                                  |
| -------------- | ----------- | ----------------------------------------------------------- |
| `id`           | UUID        | Primary key                                                 |
| `user_id`      | UUID        | FK → users.id                                               |
| `session_id`   | UUID        | FK → sessions.id                                            |
| `type`         | VARCHAR(30) | `workout_recommendation` / `anomaly_alert` / `zone_summary` |
| `content`      | JSONB       | Isi rekomendasi dalam format JSON                           |
| `generated_at` | TIMESTAMPTZ | Waktu dibuat                                                |

---

### Tabel `invite_codes` _(dimodifikasi)_

| Kolom        | Tipe        | Keterangan                                 |
| ------------ | ----------- | ------------------------------------------ |
| `id`         | UUID        | Primary key                                |
| `company_id` | UUID        | FK → companies.id _(rename dari club_id)_  |
| `code`       | VARCHAR(64) | Kode unik 64 karakter hex                  |
| `created_by` | UUID        | FK → users.id (yang membuat kode)          |
| `used_by`    | UUID        | FK → users.id (yang memakai, null = belum) |
| `expires_at` | TIMESTAMPTZ | Kadaluarsa (7 hari dari dibuat)            |
| `used_at`    | TIMESTAMPTZ | Waktu dipakai                              |
| `created_at` | TIMESTAMPTZ | Waktu dibuat                               |

---

### Tabel `password_reset_tokens` _(tidak berubah)_

| Kolom        | Tipe        | Keterangan                                     |
| ------------ | ----------- | ---------------------------------------------- |
| `id`         | UUID        | Primary key                                    |
| `user_id`    | UUID        | FK → users.id                                  |
| `token_hash` | TEXT        | SHA-256 hash dari raw token (tidak simpan raw) |
| `expires_at` | TIMESTAMPTZ | Kadaluarsa (1 jam dari dibuat)                 |
| `used_at`    | TIMESTAMPTZ | Waktu dipakai (null = belum dipakai)           |
| `created_at` | TIMESTAMPTZ | Waktu dibuat                                   |

---

### InfluxDB — Time-Series Database

**Bucket `heartrate`** (retention 90 hari) — data HR raw setiap detik

**Bucket `heartrate_aggregated`** (retention 2 tahun) — data HR agregasi per menit

| Field/Tag    | Tipe           | Keterangan                           |
| ------------ | -------------- | ------------------------------------ |
| `company_id` | tag            | Isolasi per company (wajib di query) |
| `user_id`    | tag            | Isolasi per member                   |
| `session_id` | tag            | Grouping per sesi                    |
| `hr`         | field (int)    | Heart rate dalam bpm                 |
| `rr`         | field (float)  | RR interval dalam ms (opsional)      |
| `hr_zone`    | field (string) | Zona HR hasil klasifikasi            |
| `_time`      | timestamp      | Auto dari InfluxDB                   |

---

### Redis — Cache & Buffer

| Key                                | TTL          | Kegunaan                                       |
| ---------------------------------- | ------------ | ---------------------------------------------- |
| `hr_buffer:{company_id}:{user_id}` | —            | Buffer HR sebelum flush ke InfluxDB            |
| `rate_limit:login:{ip}`            | 15 menit     | Counter login gagal per IP                     |
| `rate_limit:reset:{email}`         | 1 jam        | Counter reset password per email               |
| `zone_state:{user_id}`             | 2 jam        | Zona HR aktif + timestamp masuk zona           |
| `alert_cooldown:{user_id}:{type}`  | 60s/120s     | Cooldown alert CRITICAL/WARNING                |
| `session_last_hr:{session_id}`     | 2 jam        | Timestamp HR terakhir (deteksi orphan session) |
| `mqtt_session:{clientId}`          | sesuai token | Session MQTT untuk ACL lookup                  |
| `refresh_token:{userId}`           | 7 hari       | Refresh token JWT                              |

---

## Changelog

### Version 2.0 (Januari 2024)

**🎯 Fitur Baru:**

- Workout Library Management: Kelola workout dengan video/gambar panduan
- Workout Assignment: Assign workout ke member dengan deadline tracking
- Asset Management: Upload dan kelola media untuk workout
- Device Management: Kelola sensor HR company & individual
- Device Auto-Resolution: Sistem otomatis identifikasi device dari MAC address
- Enhanced RBAC: Dynamic permissions, satu user bisa punya role berbeda per company

**🔧 Improvements:**

- Refactor `clubs` → `companies` untuk konsistensi terminologi
- Tambah soft delete untuk workouts
- Tambah field `updated_at` untuk tracking perubahan
- Support multipart/form-data untuk upload asset
- Improved error messages dengan field-specific validation

**🧪 Testing:**

- Total 235+ automated tests (naik dari 120 tests v1.0)
- 80 property-based tests dengan 100+ iterations
- 4 integration tests untuk end-to-end flows
- Test coverage 85%+ untuk business logic

**🐛 Bug Fixes:**

- Fix device.service.test.ts mock query count mismatch
- Fix MQTT ACL untuk company devices
- Fix orphan session detection edge cases
- Fix timezone handling untuk workout assignment dates

---

### Version 1.0 (November 2023)

**🚀 Initial Release:**

- Multi-tenant architecture dengan company isolation
- Real-time HR monitoring via MQTT
- ML-powered anomaly detection
- JWT + MQTT token authentication
- RBAC dengan 4 roles
- InfluxDB time-series storage
- Grafana monitoring dashboard
- 120 automated tests

---

## Roadmap

### Version 2.1 (Q1 2024) - Planned

- [ ] Mobile App (React Native) untuk member
- [ ] Push notification untuk alerts ke mobile
- [ ] Workout video streaming optimization
- [ ] Export workout history to PDF/CSV
- [ ] Advanced analytics dashboard untuk club_owner
- [ ] Workout template library (pre-built workouts)

### Version 3.0 (Q2 2024) - Planned

- [ ] Social features: member bisa share progress
- [ ] Leaderboard per workout/challenge
- [ ] Integration dengan wearables lain (Apple Watch, Garmin)
- [ ] AI-powered workout personalization
- [ ] Multi-language support (EN, ID, JP)
- [ ] White-label customization untuk club

---

---

## FAQ (Frequently Asked Questions)

### Umum

**Q: Apakah aplikasi mobile termasuk dalam proyek ini?**  
A: Tidak. Sensor Coospo menggunakan aplikasi mobile pihak ketiga yang dikonfigurasi untuk mengirim data ke MQTT broker platform ini. Platform hanya menyediakan backend API dan web dashboard.

**Q: Sensor HR apa saja yang didukung?**  
A: Saat ini hanya Coospo HW706. Sensor lain tidak didukung karena perbedaan protokol dan payload format.

**Q: Berapa lama data HR disimpan?**  
A: Data raw (per detik) disimpan 90 hari di InfluxDB. Data agregasi (per menit) disimpan 2 tahun.

---

### Development

**Q: Bagaimana cara menjalankan hanya API Server tanpa ML Service?**  
A: ML Service bersifat opsional. Jika ML Service tidak berjalan, sistem akan log warning tapi tetap simpan data HR. Fitur anomaly detection dan recommendations tidak akan tersedia.

**Q: Port 3001 sudah dipakai, bagaimana mengubahnya?**  
A: Edit `apps/api/src/config.ts` dan ubah `API_PORT`. Jangan lupa update `.env` untuk `NEXT_PUBLIC_API_URL` dan `ML_SERVICE_URL`.

**Q: Bagaimana cara reset database development?**  
A:

```bash
docker compose down -v  # hapus semua volume
docker compose up -d postgres influxdb redis
cd apps/api && npm run db:migrate && npm run influx:setup
```

**Q: EMQX webhook selalu gagal auth, kenapa?**  
A: Pastikan API Server sudah running sebelum start EMQX. Jika sudah running, restart EMQX:

```bash
docker compose restart emqx
```

---

### Production

**Q: Apakah SSL wajib untuk production?**  
A: Sangat disarankan. MQTT over WebSocket (WSS) memerlukan SSL. Mobile app bisa pakai MQTT over TCP tanpa SSL (port 1883) atau dengan TLS (port 8883).

**Q: Berapa resource server yang dibutuhkan untuk 100 member aktif?**  
A: Rekomendasi minimum:

- 4 CPU cores
- 8 GB RAM
- 100 GB SSD storage
- 10 Mbps bandwidth

**Q: Apakah bisa horizontal scaling?**  
A: API Server dan ML Service bisa di-scale horizontal dengan load balancer. EMQX mendukung clustering. PostgreSQL, InfluxDB, dan Redis perlu setup replication terpisah.

**Q: Bagaimana backup data?**  
A:

- PostgreSQL: `pg_dump` scheduled via cron
- InfluxDB: backup via InfluxDB CLI atau API
- Redis: RDB atau AOF persistence

---

### Testing

**Q: Bagaimana menjalankan hanya property tests?**  
A:

```bash
# API Server
cd apps/api && npm test -- --testPathPattern=property

# ML Service
cd apps/ml && pytest tests/property/
```

**Q: Property tests sangat lambat, bisa dipercepat?**  
A: Edit `numRuns` di fast-check atau `max_examples` di hypothesis. Default 100 iterations, bisa turun ke 20 untuk development.

**Q: Bagaimana cara debug test yang gagal?**  
A: Tambahkan `console.log` atau gunakan `--verbose` flag. Untuk property tests, seed yang gagal akan di-print di output.

---

### MQTT & Sensors

**Q: Bagaimana format MAC address yang valid?**  
A: Format `XX:XX:XX:XX:XX:XX` atau `XX-XX-XX-XX-XX-XX` (case-insensitive). Contoh: `AA:BB:CC:DD:EE:FF`

**Q: Satu sensor bisa dipakai bergantian oleh beberapa member?**  
A: Bisa, jika sensor tersebut terdaftar sebagai **company device**. Saat member mulai sesi dan publish HR dengan MAC address sensor company, sistem otomatis assign device ke member tersebut (status `borrowed`).

**Q: Member bisa pakai sensor pribadi dan sensor company sekaligus?**  
A: Tidak dalam satu sesi. Sistem akan pilih device berdasarkan MAC address pertama yang publish data. Prioritas: individual device > company device.

**Q: MQTT connection timeout terus, kenapa?**  
A: Cek:

1. MQTT broker sudah running (`docker compose ps`)
2. Port tidak diblock firewall
3. Username/password (MQTT_Token) valid dan belum expired
4. Topic format benar: `fitsense/{companyId}/{userId}/hr`

---

## Kontribusi

Proyek ini adalah bagian dari thesis/capstone project. Kontribusi external tidak diterima saat ini.

---

## Lisensi

Proprietary - All Rights Reserved

---

## Kontak & Support

Untuk pertanyaan teknis atau bug report, buka issue di repository ini atau hubungi tim development.

**Tech Stack Documentation:**

- [Express.js](https://expressjs.com/)
- [Next.js](https://nextjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [EMQX](https://www.emqx.io/)
- [InfluxDB](https://docs.influxdata.com/)
- [PostgreSQL](https://www.postgresql.org/docs/)

---

**Built with ❤️ for FitSense Platform**
