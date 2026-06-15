# FitSense — Product Overview

FitSense adalah platform SaaS multi-tenant untuk monitoring heart rate (HR) real-time di gym. Setiap company (gym) terdaftar sebagai tenant yang terisolasi. Trainer memantau semua member secara live via web dashboard, dan sistem ML memberikan rekomendasi latihan serta peringatan anomali HR secara otomatis.

Data HR dikirim dari sensor Coospo melalui aplikasi mobile pihak ketiga ke MQTT Broker — aplikasi mobile tidak dibuat dalam proyek ini.

---

## Roles

| Role          | Akses                                      |
| ------------- | ------------------------------------------ |
| `super_admin` | Semua company, semua member, semua data    |
| `club_owner`  | Company sendiri + semua member company-nya |
| `trainer`     | Lihat semua member company-nya (read-only) |
| `member`      | Data diri sendiri saja                     |

> **Catatan RBAC:** Role `super_admin` disimpan di tabel `users`. Role lainnya (`club_owner`, `trainer`, `member`) disimpan di tabel `users_companies` — satu user bisa punya role berbeda di company yang berbeda.

---

## Tech Stack

| Layer          | Technology                         |
| -------------- | ---------------------------------- |
| Web Dashboard  | Next.js 14 App Router + TypeScript |
| API Server     | Node.js + Express + TypeScript     |
| ML Service     | Python + FastAPI                   |
| MQTT Broker    | EMQX                               |
| Time-series DB | InfluxDB v2 (Flux query)           |
| Relational DB  | PostgreSQL 15                      |
| Cache / queue  | Redis                              |
| Reverse proxy  | NGINX                              |
| Container      | Docker Compose                     |
| Real-time web  | mqtt.js over WebSocket (WSS)       |

---

## Alur Registrasi

- **Company** didaftarkan oleh calon pemilik gym via `POST /api/auth/register-company`. Akun `club_owner` dibuat otomatis bersamaan dengan company dan dimasukkan ke `users_companies`.
- **Member** didaftarkan melalui kode undangan yang di-generate oleh `club_owner` atau `trainer` via `POST /api/companies/:companyId/invite`. Member melakukan registrasi mandiri via `POST /api/auth/register-member`. Kode undangan berlaku 7 hari dan hanya dapat dipakai satu kali.
- **Trainer** ditambahkan langsung oleh `club_owner` via `POST /api/companies/:companyId/members`.

---

## Sensor yang Didukung

Hanya satu tipe sensor HR yang diizinkan terhubung ke platform:

| Tipe           | Keterangan             |
| -------------- | ---------------------- |
| `coospo_hw706` | Coospo HW706 HR sensor |

Sensor terhubung ke aplikasi mobile Coospo (pihak ketiga) via BLE. Aplikasi tersebut mempublikasikan data HR ke MQTT Broker setiap ≤ 1 detik selama sesi aktif.

---

## MQTT Topic Structure

```
fitsense/{company_id}/{user_id}/hr       — data HR real-time
fitsense/{company_id}/{user_id}/alerts   — peringatan anomali (publish: ML service)
```

### ACL ringkas per role

| Role                     | Publish                                       | Subscribe                       |
| ------------------------ | --------------------------------------------- | ------------------------------- |
| `member`                 | `fitsense/{company_id}/{user_id}/hr` miliknya | topik hr + alerts miliknya      |
| `trainer` / `club_owner` | dilarang                                      | `fitsense/{company_id}/#`       |
| `super_admin`            | dilarang                                      | `fitsense/#`                    |
| `ml_service`             | `fitsense/{company_id}/{user_id}/alerts`      | dilarang                        |
| Web Dashboard            | dilarang                                      | sesuai role pengguna yang login |

---

## Core Principles

- **Isolasi multi-tenant wajib** — setiap query PostgreSQL dan InfluxDB harus difilter per `company_id`, kecuali `super_admin`. Setiap request yang menyertakan `companyId` berbeda dari `company_id` di JWT harus ditolak dengan HTTP 403.
- **RBAC via users_companies** — role ditentukan dari tabel `users_companies`, bukan field `role` di `users`. Super_admin adalah satu-satunya role yang masih di `users`.
- **Real-time < 1 detik** — data HR harus tampil di dashboard dalam < 1 detik sejak dipublikasikan dari sensor.
- **Keamanan berlapis** — JWT (7 hari) untuk HTTP, MQTT_Token terpisah (30 menit, auto-refresh < 5 menit sebelum expired) untuk koneksi MQTT.
- **HR Zone** diklasifikasikan berdasarkan `Max_HR = 220 - usia`:
  - `rest` — HR < 50% Max_HR
  - `fat_burn` — 50% ≤ HR < 60% Max_HR
  - `cardio` — 60% ≤ HR < 70% Max_HR
  - `aerobic` — 70% ≤ HR < 80% Max_HR
  - `peak` — HR ≥ 80% Max_HR
  - `unknown` — jika usia member tidak tersedia atau bernilai nol
- **Payload HR valid** — `hr` integer 20–300 bpm, `rr` float 200–2000 ms (opsional), `session_id` UUID, `timestamp` Unix ms.
- **Alert anomali** — dievaluasi real-time per data point oleh ML Service dengan cooldown: CRITICAL (HR > 95% Max_HR) cooldown 60 detik, WARNING (HR > 85% Max_HR selama > 10 menit, atau HR < 40 bpm) cooldown 120 detik.
- **Data retention** — data HR raw disimpan 90 hari di InfluxDB, downsampled per menit disimpan 2 tahun di bucket `heartrate_aggregated`. Tabel `heart_rate` di PostgreSQL hanya untuk summary/snapshot per sesi.
