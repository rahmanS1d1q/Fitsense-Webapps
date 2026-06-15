# FitSense — Project Structure

```
fitsense/
├── apps/
│   ├── api/                              # Node.js + Express (port 3001)
│   │   ├── src/
│   │   │   ├── routes/                   # auth, clubs, members, sessions, hr,
│   │   │   │                             # recommendations, mqtt-webhook, admin
│   │   │   ├── services/                 # AuthService, ClubService, MemberService,
│   │   │   │                             # SessionService, HRQueryService,
│   │   │   │                             # RecommendationService, InviteService,
│   │   │   │                             # PasswordResetService, BatchWriter,
│   │   │   │                             # MqttConsumer, HRZoneClassifier,
│   │   │   │                             # OrphanSessionJob
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts    # JWT verification → HTTP 401
│   │   │   │   ├── rbac.middleware.ts    # Role-based access control → HTTP 403
│   │   │   │   └── tenant.middleware.ts  # clubId URL vs JWT club_id → HTTP 403
│   │   │   └── index.ts
│   │   ├── tests/
│   │   │   ├── unit/                     # Unit tests per service
│   │   │   └── property/                 # fast-check property tests (20 properties)
│   │   ├── migrations/                   # SQL migration files (semua tabel + index)
│   │   └── Dockerfile
│   │
│   ├── ml/                               # Python + FastAPI (port 8000)
│   │   ├── main.py
│   │   ├── routers/
│   │   │   ├── anomaly.py                # POST /ml/anomaly-check
│   │   │   ├── recommendation.py         # POST /ml/analyze-session
│   │   │   └── health.py                 # GET /ml/health
│   │   ├── services/
│   │   │   ├── zone_state_tracker.py     # Redis: zone_state:{user_id}
│   │   │   └── alert_cooldown_manager.py # Redis: alert_cooldown:{user_id}:{type}
│   │   ├── models/
│   │   │   └── hr_analyzer.py
│   │   ├── tests/
│   │   │   ├── unit/                     # Unit tests per router/service
│   │   │   └── property/                 # hypothesis property tests
│   │   └── Dockerfile
│   │
│   ├── web/                              # Next.js 14 App Router (TypeScript)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/                # Login semua role
│   │   │   │   ├── register/             # Registrasi mandiri member via kode undangan
│   │   │   │   ├── forgot-password/      # Request reset password
│   │   │   │   └── reset-password/       # Form password baru via token
│   │   │   └── dashboard/
│   │   │       ├── trainer/              # Lihat semua member club (subscribe fitsense/{club_id}/#)
│   │   │       ├── member/               # Lihat data diri sendiri
│   │   │       └── admin/                # Super admin: semua club + storage stats
│   │   ├── components/
│   │   │   ├── HRMonitor.tsx             # HR real-time per member via mqtt.js
│   │   │   ├── HRZoneBadge.tsx           # Badge warna zona HR
│   │   │   ├── AlertBanner.tsx           # Notifikasi anomali (CRITICAL merah, WARNING kuning)
│   │   │   ├── MemberList.tsx            # Virtualized list react-window, maks 100 di DOM
│   │   │   ├── MemberSearch.tsx          # Filter member by nama (lokal, tanpa request)
│   │   │   └── ConnectionStatus.tsx      # Indikator koneksi MQTT (connected/disconnected/reconnecting)
│   │   ├── hooks/
│   │   │   └── useMqtt.ts                # MQTT WebSocket + auto-reconnect backoff + token refresh
│   │   └── Dockerfile
│   │
│   └── mobile/                           # React Native (iOS + Android)
│       ├── src/
│       │   ├── ble/                      # BLEManager: scan, connect, reconnect Coospo sensor
│       │   ├── mqtt/                     # MqttPublisher: publish HR, auto-refresh token
│       │   ├── services/                 # SessionManager: start/end sesi
│       │   └── screens/
│       │       ├── LoginScreen.tsx        # Login sebelum akses fitur apapun
│       │       └── SessionScreen.tsx      # HRDisplay: HR, zona, durasi, alert haptic
│       └── package.json
│
├── emqx/
│   ├── emqx.conf                         # Listener config: TCP :1883, WS :8083, TLS :8883
│   └── acl.conf                          # Fallback ACL deny-all jika webhook tidak tersedia
│
├── grafana/
│   └── provisioning/
│       ├── datasources/
│       │   ├── influxdb.yaml             # Datasource InfluxDB v2 (Flux)
│       │   └── postgres.yaml             # Datasource PostgreSQL
│       └── dashboards/
│           └── fitsense-overview.json    # Dashboard: HR per club, member aktif, status layanan
│
├── nginx/
│   └── nginx.conf                        # :443 → API :3001 | :8084 WSS → EMQX :8083
│
├── scripts/
│   ├── test-setup.sh                     # Spin up docker-compose.test.yml + migrate + run tests + teardown
│   └── db-clean.sh                       # TRUNCATE PostgreSQL + FLUSHDB Redis + deleteData InfluxDB
│
├── docker-compose.yml                    # Production: semua service
├── docker-compose.test.yml               # Test: port berbeda (PG :5433, IDB :8087, Redis :6380, EMQX :1884/:8085)
└── .env.example                          # Semua variabel environment yang diperlukan
```

---

## Conventions

- Semua service ada di `apps/` — jangan taruh kode aplikasi di root
- API routes di `apps/api/src/routes/`, business logic di `apps/api/src/services/`
- Semua file API Server ditulis dalam TypeScript (`.ts`) — jangan gunakan `.js`
- Middleware selalu diapply dalam urutan: `auth.middleware` → `rbac.middleware` → `tenant.middleware` → route handler
- Semua query PostgreSQL wajib include filter `company_id` (kecuali `super_admin`)
- Semua query InfluxDB wajib include filter tag `company_id` dan `user_id`
- RBAC ditentukan dari tabel `users_companies`, bukan field `role` di `users`
- HR Zone Classifier dijalankan di API Server (bukan ML Service) — logika sederhana, harus real-time
- Batch Writer flush ke InfluxDB setiap 1 detik via Redis buffer — jangan write langsung per data point
- ML analyze-session dipanggil async (fire-and-forget) setelah session end
- Jika ML Service tidak dapat dijangkau, log warning dan lanjutkan — jangan drop data HR
- Unit tests dan property tests diletakkan di `tests/unit/` dan `tests/property/` dalam masing-masing app
- Tag komentar property test wajib: `// Feature: fitsense-platform, Property {N}: {deskripsi}`
- Setiap property test dijalankan minimal 100 iterasi (`numRuns: 100` untuk fast-check, `max_examples=100` untuk hypothesis)

---

## Redis Key Patterns

| Key                                | TTL          | Penulis                | Pembaca                | Kegunaan                                     |
| ---------------------------------- | ------------ | ---------------------- | ---------------------- | -------------------------------------------- |
| `hr_buffer:{company_id}:{user_id}` | —            | `MqttConsumer`         | `BatchWriter`          | Buffer HR sebelum flush ke InfluxDB          |
| `rate_limit:login:{ip}`            | 15 menit     | `AuthService`          | `AuthService`          | Counter login gagal per IP                   |
| `rate_limit:reset:{email}`         | 1 jam        | `PasswordResetService` | `PasswordResetService` | Counter reset password per email             |
| `zone_state:{user_id}`             | 2 jam        | `MqttConsumer`         | `AnomalyChecker`       | Zona aktif + timestamp masuk zona per member |
| `alert_cooldown:{user_id}:{type}`  | per jenis    | `AnomalyChecker`       | `AnomalyChecker`       | Cooldown: CRITICAL = 60s, WARNING = 120s     |
| `session_last_hr:{session_id}`     | 2 jam        | `MqttConsumer`         | `OrphanSessionJob`     | Timestamp HR terakhir untuk deteksi orphan   |
| `mqtt_session:{clientId}`          | sesuai token | `MqttWebhookHandler`   | `MqttWebhookHandler`   | Session MQTT untuk ACL lookup                |
| `refresh_token:{userId}`           | 7 hari       | `AuthService`          | `AuthService`          | Refresh token JWT                            |
