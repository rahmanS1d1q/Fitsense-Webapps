# Dokumen Persyaratan — FitSense Platform

**Versi:** 1.1  
**Tanggal:** 2026-04-06  
**Status:** Revisi — tambahan persyaratan 18, 19, 20 dan perbaikan persyaratan 2, 6, 9, 10, 13

---

## Pendahuluan

FitSense adalah platform SaaS multi-tenant untuk monitoring heart rate (HR) secara real-time di gym. Setiap club gym dapat mendaftarkan diri sebagai tenant, pelatih memantau semua member secara live melalui dashboard web, member memantau data diri sendiri melalui aplikasi mobile, dan sistem ML memberikan rekomendasi latihan serta peringatan anomali HR secara otomatis.

Platform ini terdiri dari empat komponen utama:

- **Mobile App** (React Native) — menghubungkan sensor HR via BLE dan mempublikasikan data ke broker MQTT
- **Web Dashboard** (Next.js 14) — tampilan real-time untuk trainer, club owner, dan super admin
- **API Server** (Node.js + Express) — orkestrasi bisnis, autentikasi, dan penyimpanan data
- **ML Service** (Python + FastAPI) — deteksi anomali HR dan rekomendasi latihan

---

## Glosarium

| Istilah | Definisi |
|---|---|
| **System** | Platform FitSense secara keseluruhan |
| **API_Server** | Layanan backend Node.js + Express yang menangani semua request HTTP |
| **ML_Service** | Layanan Python + FastAPI yang menjalankan analisis anomali dan rekomendasi |
| **MQTT_Broker** | Layanan EMQX yang menjadi perantara pesan HR real-time |
| **Mobile_App** | Aplikasi React Native yang berjalan di perangkat iOS/Android member |
| **Web_Dashboard** | Aplikasi Next.js 14 yang diakses trainer, club owner, dan super admin |
| **Batch_Writer** | Komponen dalam API_Server yang mengumpulkan data HR dan menulis ke InfluxDB secara berkala |
| **MQTT_Consumer** | Komponen dalam API_Server yang berlangganan semua topik MQTT dan mendistribusikan pesan |
| **HR_Zone_Classifier** | Komponen dalam API_Server yang mengklasifikasikan zona HR berdasarkan usia |
| **Club** | Entitas gym yang terdaftar sebagai tenant di platform FitSense |
| **Member** | Pengguna dengan role `member` yang merupakan anggota dari sebuah Club |
| **Trainer** | Pengguna dengan role `trainer` yang memantau Member dalam Club-nya |
| **Club_Owner** | Pengguna dengan role `club_owner` yang mengelola Club-nya |
| **Super_Admin** | Pengguna dengan role `super_admin` yang memiliki akses penuh ke seluruh platform |
| **Sesi** | Periode latihan seorang Member yang memiliki waktu mulai dan selesai |
| **Orphan_Session** | Sesi yang tidak pernah diakhiri karena gangguan teknis (HP mati, koneksi putus) |
| **HR** | Heart Rate, detak jantung dalam satuan bpm (beats per minute) |
| **RR_Interval** | Jarak waktu antar detak jantung dalam satuan milidetik (ms) |
| **HR_Zone** | Klasifikasi intensitas latihan berdasarkan persentase HR maksimal: `rest`, `fat_burn`, `cardio`, `aerobic`, `peak` |
| **Max_HR** | Detak jantung maksimal teoritis, dihitung dengan rumus `220 - usia` |
| **JWT** | JSON Web Token, digunakan untuk autentikasi sesi HTTP |
| **MQTT_Token** | Token berumur pendek (30 menit) yang digunakan khusus untuk autentikasi koneksi MQTT |
| **ACL** | Access Control List, aturan yang mengatur hak publish/subscribe pada MQTT_Broker |
| **InfluxDB** | Database time-series yang menyimpan data HR historis |
| **PostgreSQL** | Database relasional yang menyimpan data master (club, user, sesi, rekomendasi) |
| **Redis** | Cache dan antrian yang digunakan sebagai buffer Batch_Writer |
| **Alert_Cooldown** | Periode minimum antar dua peringatan anomali yang dikirimkan untuk Member yang sama |
| **Data_Retention** | Kebijakan penyimpanan dan penghapusan data HR historis di InfluxDB |

---

## Persyaratan

### Persyaratan 1: Pendaftaran dan Manajemen Club

**User Story:** Sebagai pemilik gym, saya ingin mendaftarkan club saya ke platform FitSense, agar saya dapat mulai menggunakan layanan monitoring HR untuk member saya.

#### Kriteria Penerimaan

1. WHEN seorang pengguna mengirimkan permintaan `POST /api/auth/register-club` dengan nama club, slug, alamat, dan nomor telepon yang valid, THE API_Server SHALL membuat entri Club baru di PostgreSQL dengan status `active` dan mengembalikan data club beserta kredensial Club_Owner.
2. IF slug yang dikirimkan sudah digunakan oleh Club lain, THEN THE API_Server SHALL mengembalikan respons HTTP 409 dengan pesan error yang menjelaskan konflik slug.
3. THE API_Server SHALL memastikan slug Club hanya mengandung karakter alfanumerik dan tanda hubung, dengan panjang antara 3 hingga 50 karakter.
4. WHEN seorang Super_Admin mengirimkan permintaan `GET /api/clubs`, THE API_Server SHALL mengembalikan daftar semua Club yang terdaftar beserta status masing-masing.
5. WHEN seorang Super_Admin mengirimkan permintaan `PATCH /api/clubs/:clubId`, THE API_Server SHALL memperbarui data Club yang ditentukan dan mengembalikan data Club yang telah diperbarui.
6. WHEN seorang Super_Admin mengirimkan permintaan `DELETE /api/clubs/:clubId`, THE API_Server SHALL mengubah status Club menjadi `suspended` dan mencabut akses semua pengguna Club tersebut.
7. IF pengguna dengan role selain `super_admin` mengakses endpoint manajemen Club (`/api/clubs`), THEN THE API_Server SHALL mengembalikan respons HTTP 403.

---

### Persyaratan 2: Autentikasi dan Otorisasi *(direvisi)*

**User Story:** Sebagai pengguna platform, saya ingin dapat login dengan aman dan mendapatkan akses sesuai role saya, agar data antar club tetap terisolasi.

#### Kriteria Penerimaan

1. WHEN seorang pengguna mengirimkan `POST /api/auth/login` dengan email dan password yang valid, THE API_Server SHALL mengembalikan JWT dengan masa berlaku 7 hari dan MQTT_Token dengan masa berlaku 30 menit.
2. IF email atau password yang dikirimkan tidak valid, THEN THE API_Server SHALL mengembalikan respons HTTP 401 tanpa mengungkapkan informasi spesifik tentang field mana yang salah.
3. WHEN seorang pengguna mengirimkan `POST /api/auth/refresh` dengan refresh token yang valid, THE API_Server SHALL menerbitkan JWT baru dan MQTT_Token baru.
4. WHEN seorang pengguna mengirimkan `POST /api/auth/logout`, THE API_Server SHALL membatalkan token sesi yang aktif.
5. THE API_Server SHALL memvalidasi JWT pada setiap request ke endpoint yang dilindungi dan mengembalikan HTTP 401 jika token tidak valid atau kedaluwarsa.
6. THE API_Server SHALL menerapkan pemeriksaan role berbasis RBAC pada setiap endpoint dan mengembalikan HTTP 403 jika role pengguna tidak memiliki izin yang diperlukan.
7. THE API_Server SHALL memastikan semua query PostgreSQL menyertakan filter `club_id` yang sesuai dengan club pengguna yang sedang login, kecuali untuk pengguna dengan role `super_admin`.
8. WHEN seorang pengguna mengirimkan `POST /api/auth/mqtt-token`, THE API_Server SHALL menerbitkan MQTT_Token baru dengan scope ACL yang sesuai dengan role pengguna.
9. *(tambahan)* THE API_Server SHALL membatasi percobaan login maksimal 5 kali dalam 15 menit per alamat IP. IF batas tersebut terlampaui, THEN THE API_Server SHALL mengembalikan respons HTTP 429 dan memblokir percobaan login dari IP tersebut selama 15 menit berikutnya.
10. *(tambahan)* THE API_Server SHALL mencatat setiap percobaan login yang gagal ke log dengan menyertakan alamat IP dan timestamp, tanpa menyertakan password yang dikirimkan.

---

### Persyaratan 3: Manajemen Member

**User Story:** Sebagai Club_Owner atau Trainer, saya ingin mengelola daftar member di club saya, agar saya dapat memantau dan mengorganisir anggota gym.

#### Kriteria Penerimaan

1. WHEN seorang Club_Owner mengirimkan `POST /api/clubs/:clubId/members` dengan data member yang valid, THE API_Server SHALL membuat akun Member baru yang terhubung ke Club yang ditentukan.
2. IF `clubId` pada URL tidak sesuai dengan `club_id` Club_Owner yang sedang login, THEN THE API_Server SHALL mengembalikan respons HTTP 403.
3. WHEN seorang Trainer atau Club_Owner mengirimkan `GET /api/clubs/:clubId/members`, THE API_Server SHALL mengembalikan daftar semua Member aktif dalam Club tersebut.
4. WHEN seorang Member mengirimkan `GET /api/clubs/:clubId/members/:userId`, THE API_Server SHALL mengembalikan data profil hanya jika `userId` sesuai dengan identitas Member yang sedang login.
5. WHEN seorang Club_Owner mengirimkan `PATCH /api/clubs/:clubId/members/:userId`, THE API_Server SHALL memperbarui data Member yang ditentukan.
6. WHEN seorang Club_Owner mengirimkan `DELETE /api/clubs/:clubId/members/:userId`, THE API_Server SHALL menonaktifkan akun Member tersebut dan mencabut semua token aktifnya.
7. THE API_Server SHALL memastikan email Member bersifat unik di seluruh platform.

---

### Persyaratan 4: Manajemen Perangkat (Device)

**User Story:** Sebagai Member, saya ingin mendaftarkan sensor HR saya ke akun saya, agar Mobile_App dapat mengenali dan menghubungkan perangkat secara otomatis.

#### Kriteria Penerimaan

1. WHEN seorang Member mendaftarkan perangkat baru dengan `device_type` dan `mac_address` yang valid, THE API_Server SHALL menyimpan data perangkat yang terhubung ke akun Member dan Club yang sesuai.
2. IF `mac_address` yang didaftarkan sudah terdaftar untuk Member yang sama, THEN THE API_Server SHALL mengembalikan respons HTTP 409.
3. THE API_Server SHALL membatasi pendaftaran perangkat hanya untuk tipe yang didukung: `coospo_h6` dan `coospo_hw706`.

---

### Persyaratan 5: Koneksi BLE dan Publikasi Data HR (Mobile App)

**User Story:** Sebagai Member, saya ingin Mobile_App menghubungkan sensor HR saya via Bluetooth dan mengirimkan data HR secara real-time, agar data latihan saya tercatat secara otomatis.

#### Kriteria Penerimaan

1. WHEN Mobile_App mendeteksi sensor HR yang terdaftar dalam jangkauan Bluetooth, THE Mobile_App SHALL memulai koneksi BLE secara otomatis.
2. WHEN koneksi BLE berhasil dan Sesi aktif, THE Mobile_App SHALL mempublikasikan data HR ke topik MQTT `fitsense/{club_id}/{user_id}/hr` dengan payload yang mengandung `hr`, `rr`, `session_id`, dan `timestamp`.
3. THE Mobile_App SHALL mempublikasikan data HR dengan interval tidak lebih dari 1 detik per data point selama Sesi berlangsung.
4. IF koneksi BLE terputus selama Sesi aktif, THEN THE Mobile_App SHALL mencoba menyambung kembali secara otomatis dengan interval backoff hingga 30 detik.
5. THE Mobile_App SHALL menggunakan MQTT_Token (bukan JWT) untuk autentikasi koneksi ke MQTT_Broker.
6. WHEN MQTT_Token mendekati kedaluwarsa (kurang dari 5 menit tersisa), THE Mobile_App SHALL meminta MQTT_Token baru secara otomatis tanpa interaksi pengguna.
7. THE Mobile_App SHALL hanya diizinkan mempublikasikan ke topik `fitsense/{club_id}/{user_id}/hr` miliknya sendiri dan dilarang mempublikasikan ke topik lain.

---

### Persyaratan 6: Autentikasi dan ACL MQTT *(direvisi)*

**User Story:** Sebagai operator platform, saya ingin MQTT_Broker memvalidasi setiap koneksi dan aksi publish/subscribe, agar data HR antar club dan antar member tetap terisolasi.

#### Kriteria Penerimaan

1. WHEN MQTT_Broker menerima permintaan koneksi dari client, THE MQTT_Broker SHALL memanggil webhook `POST /api/mqtt/auth` pada API_Server untuk memvalidasi kredensial.
2. IF API_Server mengembalikan respons non-200 pada webhook auth, THEN THE MQTT_Broker SHALL menolak koneksi client tersebut.
3. WHEN MQTT_Broker menerima permintaan publish atau subscribe dari client, THE MQTT_Broker SHALL memanggil webhook `POST /api/mqtt/acl` pada API_Server untuk memvalidasi izin.
4. THE API_Server SHALL mengizinkan Mobile_App mempublikasikan hanya ke topik `fitsense/{club_id}/{user_id}/hr` yang sesuai dengan identitas Member.
5. THE API_Server SHALL mengizinkan Trainer dan Club_Owner berlangganan topik `fitsense/{club_id}/#` sesuai dengan `club_id` mereka.
6. THE API_Server SHALL mengizinkan Member berlangganan hanya topik `fitsense/{club_id}/{user_id}/hr` miliknya sendiri.
7. THE API_Server SHALL mengizinkan Super_Admin berlangganan topik `fitsense/#`.
8. THE API_Server SHALL melarang semua client Web_Dashboard mempublikasikan ke topik MQTT manapun.
9. *(tambahan)* THE API_Server SHALL mengizinkan ML_Service mempublikasikan ke topik `fitsense/{club_id}/{user_id}/alerts` untuk mengirimkan peringatan anomali. ML_Service SHALL dilarang mempublikasikan ke topik selain namespace `/alerts`.
10. *(tambahan)* THE API_Server SHALL mengizinkan Trainer dan Club_Owner berlangganan topik `fitsense/{club_id}/+/alerts` untuk menerima peringatan anomali semua Member dalam Club-nya.
11. *(tambahan)* THE API_Server SHALL mengizinkan Member berlangganan topik `fitsense/{club_id}/{user_id}/alerts` miliknya sendiri untuk menerima peringatan anomali pada Mobile_App.

---

### Persyaratan 7: Penerimaan dan Penyimpanan Data HR Real-Time

**User Story:** Sebagai platform, saya ingin setiap data HR yang dipublikasikan oleh Mobile_App diproses dan disimpan secara efisien, agar data tersedia untuk monitoring real-time dan analisis historis.

#### Kriteria Penerimaan

1. WHEN MQTT_Consumer menerima pesan pada topik `fitsense/#`, THE MQTT_Consumer SHALL mendistribusikan pesan tersebut secara paralel ke Batch_Writer dan ML_Service untuk pemeriksaan anomali.
2. THE Batch_Writer SHALL mengakumulasi data HR dalam buffer Redis dan melakukan flush ke InfluxDB setiap 1 detik.
3. THE Batch_Writer SHALL menyimpan setiap data point ke InfluxDB dengan tag `club_id`, `user_id`, `session_id`, dan field `hr`, `rr`, `hr_zone`.
4. IF koneksi ke InfluxDB gagal saat flush, THEN THE Batch_Writer SHALL mempertahankan data di buffer Redis dan mencoba kembali pada siklus flush berikutnya.
5. THE HR_Zone_Classifier SHALL mengklasifikasikan setiap data point HR ke dalam zona `rest`, `fat_burn`, `cardio`, `aerobic`, atau `peak` berdasarkan persentase Max_HR pengguna, dan menyertakan hasil klasifikasi dalam payload yang diteruskan.
6. THE HR_Zone_Classifier SHALL menghitung Max_HR menggunakan rumus `220 - usia` berdasarkan data usia Member.

---

### Persyaratan 8: Klasifikasi HR Zone

**User Story:** Sebagai platform, saya ingin setiap data HR diklasifikasikan ke zona latihan yang tepat secara real-time, agar trainer dan member dapat melihat intensitas latihan secara langsung.

#### Kriteria Penerimaan

1. THE HR_Zone_Classifier SHALL mengklasifikasikan HR ke zona `rest` jika nilai HR kurang dari 50% dari Max_HR.
2. THE HR_Zone_Classifier SHALL mengklasifikasikan HR ke zona `fat_burn` jika nilai HR berada antara 50% hingga kurang dari 60% dari Max_HR.
3. THE HR_Zone_Classifier SHALL mengklasifikasikan HR ke zona `cardio` jika nilai HR berada antara 60% hingga kurang dari 70% dari Max_HR.
4. THE HR_Zone_Classifier SHALL mengklasifikasikan HR ke zona `aerobic` jika nilai HR berada antara 70% hingga kurang dari 80% dari Max_HR.
5. THE HR_Zone_Classifier SHALL mengklasifikasikan HR ke zona `peak` jika nilai HR 80% atau lebih dari Max_HR.
6. IF usia Member tidak tersedia atau bernilai nol, THEN THE HR_Zone_Classifier SHALL mengembalikan zona `unknown` dan mencatat peringatan.
7. FOR ALL nilai HR yang valid dan usia Member yang valid, THE HR_Zone_Classifier SHALL menghasilkan tepat satu klasifikasi zona (round-trip property: klasifikasi yang sama untuk input yang sama).

---

### Persyaratan 9: Deteksi Anomali HR Real-Time *(direvisi)*

**User Story:** Sebagai Trainer, saya ingin menerima peringatan otomatis ketika HR member mencapai kondisi berbahaya, agar saya dapat segera mengambil tindakan.

#### Kriteria Penerimaan

1. WHEN ML_Service menerima data point HR melalui `POST /ml/anomaly-check`, THE ML_Service SHALL mengevaluasi kondisi anomali berdasarkan nilai HR, Max_HR, dan durasi di zona saat ini.
2. WHEN nilai HR melebihi 95% dari Max_HR Member, THE ML_Service SHALL menerbitkan peringatan `CRITICAL` ke topik MQTT `fitsense/{club_id}/{user_id}/alerts`.
3. WHEN nilai HR melebihi 85% dari Max_HR Member dan Member telah berada di zona tersebut selama lebih dari 10 menit, THE ML_Service SHALL menerbitkan peringatan `WARNING` ke topik MQTT `fitsense/{club_id}/{user_id}/alerts`.
4. WHEN nilai HR kurang dari 40 bpm, THE ML_Service SHALL menerbitkan peringatan `WARNING` dengan pesan pemeriksaan sensor ke topik MQTT `fitsense/{club_id}/{user_id}/alerts`.
5. THE ML_Service SHALL menyelesaikan evaluasi anomali dalam waktu kurang dari 500ms per data point.
6. IF ML_Service tidak dapat menjangkau MQTT_Broker untuk menerbitkan peringatan, THEN THE ML_Service SHALL mencatat kegagalan pengiriman peringatan ke log dengan tingkat `ERROR`.
7. *(tambahan)* THE ML_Service SHALL menerapkan Alert_Cooldown per Member per jenis peringatan. Peringatan `CRITICAL` memiliki cooldown 60 detik dan peringatan `WARNING` memiliki cooldown 120 detik. IF peringatan yang sama telah dikirimkan dalam periode cooldown, THEN THE ML_Service SHALL melewati pengiriman peringatan berikutnya tanpa mencatat error.
8. *(tambahan)* THE ML_Service SHALL menyimpan state zona aktif dan timestamp masuk zona per Member di Redis untuk mendukung evaluasi durasi di zona pada kriteria 3.

---

### Persyaratan 10: Manajemen Sesi Latihan *(direvisi)*

**User Story:** Sebagai Member, saya ingin dapat memulai dan mengakhiri sesi latihan dari Mobile_App, agar data HR saya terkelompokkan per sesi dan statistik sesi tersimpan.

#### Kriteria Penerimaan

1. WHEN Mobile_App mengirimkan `POST /api/sessions/start` dengan `user_id` dan `club_id` yang valid, THE API_Server SHALL membuat entri Sesi baru di PostgreSQL dengan `started_at` saat ini dan mengembalikan `session_id`.
2. IF Member sudah memiliki Sesi yang aktif (belum diakhiri), THEN THE API_Server SHALL mengembalikan respons HTTP 409 dan `session_id` dari Sesi yang sedang aktif.
3. WHEN Mobile_App mengirimkan `POST /api/sessions/end` dengan `session_id` yang valid, THE API_Server SHALL memperbarui Sesi dengan `ended_at`, `avg_hr`, `max_hr`, `min_hr`, `duration_minutes`, dan `hr_zone` dominan.
4. WHEN Sesi berhasil diakhiri, THE API_Server SHALL memanggil `POST /ml/analyze-session` pada ML_Service secara asinkron (fire-and-forget) tanpa menunggu respons.
5. WHEN seorang Trainer atau Club_Owner mengirimkan `GET /api/clubs/:clubId/members/:userId/sessions`, THE API_Server SHALL mengembalikan daftar Sesi historis Member tersebut diurutkan dari yang terbaru.
6. WHEN seorang pengguna mengirimkan `GET /api/clubs/:clubId/members/:userId/sessions/:sessionId`, THE API_Server SHALL mengembalikan detail lengkap Sesi yang ditentukan termasuk semua statistik HR.
7. *(tambahan)* THE API_Server SHALL menjalankan proses pengecekan Orphan_Session secara periodik setiap 30 menit. IF sebuah Sesi tidak menerima data HR baru selama lebih dari 60 menit dan belum memiliki `ended_at`, THEN THE API_Server SHALL secara otomatis mengakhiri Sesi tersebut dengan `ended_at` sama dengan timestamp data HR terakhir yang diterima, dan menandai Sesi dengan flag `auto_closed: true`.
8. *(tambahan)* WHEN Sesi ditutup secara otomatis oleh sistem (Orphan_Session), THE API_Server SHALL tetap memanggil `POST /ml/analyze-session` secara asinkron jika durasi Sesi lebih dari 5 menit, agar data sesi yang cukup panjang tetap dianalisis.

---

### Persyaratan 11: Riwayat HR dan Query Time-Series

**User Story:** Sebagai Trainer atau Member, saya ingin dapat melihat riwayat data HR dalam rentang waktu tertentu, agar saya dapat menganalisis tren latihan.

#### Kriteria Penerimaan

1. WHEN seorang pengguna mengirimkan `GET /api/clubs/:clubId/members/:userId/hr` dengan parameter `from`, `to`, dan `interval` yang valid, THE API_Server SHALL mengembalikan data HR dari InfluxDB yang diagregasi sesuai interval yang diminta.
2. THE API_Server SHALL mendukung nilai interval: `1s`, `10s`, `1m`, `5m`, `1h`.
3. IF parameter `from` atau `to` tidak dalam format ISO 8601 yang valid, THEN THE API_Server SHALL mengembalikan respons HTTP 400 dengan pesan error yang menjelaskan format yang diharapkan.
4. IF rentang waktu yang diminta melebihi 30 hari, THEN THE API_Server SHALL mengembalikan respons HTTP 400 dengan pesan error yang menjelaskan batas maksimal rentang waktu.
5. THE API_Server SHALL memastikan query InfluxDB selalu menyertakan filter `club_id` dan `user_id` yang sesuai untuk menjaga isolasi data antar tenant.

---

### Persyaratan 12: Rekomendasi Latihan Berbasis ML (Post-Session)

**User Story:** Sebagai Member, saya ingin menerima rekomendasi latihan yang dipersonalisasi setelah setiap sesi selesai, agar saya dapat meningkatkan performa latihan saya.

#### Kriteria Penerimaan

1. WHEN ML_Service menerima permintaan `POST /ml/analyze-session` dengan `session_id` yang valid, THE ML_Service SHALL mengambil data 5 sesi terakhir Member dari PostgreSQL dan InfluxDB untuk analisis.
2. THE ML_Service SHALL menghasilkan rekomendasi berdasarkan pola HR historis: jika rata-rata HR pada 3 sesi terakhir selalu berada di zona `peak`, THE ML_Service SHALL merekomendasikan penurunan intensitas dan penambahan waktu pemulihan.
3. THE ML_Service SHALL menghasilkan rekomendasi berdasarkan tren HR: jika rata-rata HR menurun dibandingkan 2 minggu sebelumnya, THE ML_Service SHALL merekomendasikan peningkatan intensitas latihan.
4. THE ML_Service SHALL menghasilkan rekomendasi berdasarkan durasi zona: jika durasi di zona `fat_burn` kurang dari 20 menit per sesi, THE ML_Service SHALL merekomendasikan perpanjangan sesi di zona fat burn.
5. WHEN ML_Service selesai menghasilkan rekomendasi, THE ML_Service SHALL menyimpan hasil rekomendasi ke tabel `ml_recommendations` di PostgreSQL dengan `type` yang sesuai.
6. WHEN seorang pengguna mengirimkan `GET /api/clubs/:clubId/members/:userId/recommendations`, THE API_Server SHALL mengembalikan daftar semua rekomendasi Member tersebut diurutkan dari yang terbaru.
7. WHEN seorang pengguna mengirimkan `GET /api/clubs/:clubId/members/:userId/recommendations/latest`, THE API_Server SHALL mengembalikan satu rekomendasi terbaru untuk Member tersebut.
8. IF ML_Service gagal menganalisis sesi karena data tidak mencukupi (kurang dari 1 sesi historis), THEN THE ML_Service SHALL mencatat kondisi ini ke log dan tidak menyimpan rekomendasi kosong.

---

### Persyaratan 13: Dashboard Real-Time Web (Trainer & Club Owner) *(direvisi)*

**User Story:** Sebagai Trainer, saya ingin melihat HR semua member club saya secara real-time di Web_Dashboard, agar saya dapat memantau kondisi seluruh member sekaligus.

#### Kriteria Penerimaan

1. WHEN Trainer atau Club_Owner membuka halaman dashboard, THE Web_Dashboard SHALL terhubung ke MQTT_Broker menggunakan MQTT_Token yang valid melalui koneksi WebSocket.
2. WHEN Web_Dashboard berhasil terhubung, THE Web_Dashboard SHALL berlangganan topik `fitsense/{club_id}/#` untuk menerima data HR semua Member dalam Club.
3. WHEN data HR baru diterima melalui MQTT, THE Web_Dashboard SHALL memperbarui tampilan HR Member yang bersangkutan dalam waktu kurang dari 1 detik.
4. WHEN peringatan anomali diterima dari topik `fitsense/{club_id}/{user_id}/alerts`, THE Web_Dashboard SHALL menampilkan notifikasi peringatan yang menonjol untuk Member yang bersangkutan.
5. WHEN MQTT_Token mendekati kedaluwarsa (kurang dari 5 menit tersisa), THE Web_Dashboard SHALL meminta MQTT_Token baru secara otomatis tanpa memutus koneksi yang sedang aktif.
6. IF koneksi WebSocket ke MQTT_Broker terputus, THEN THE Web_Dashboard SHALL mencoba menyambung kembali secara otomatis dengan interval backoff eksponensial hingga maksimal 60 detik.
7. THE Web_Dashboard SHALL menampilkan status koneksi MQTT secara visual kepada pengguna (terhubung / terputus / menyambung kembali).
8. *(tambahan)* THE Web_Dashboard SHALL mendukung tampilan hingga 100 Member aktif secara bersamaan menggunakan teknik virtualized list, sehingga hanya elemen yang terlihat di viewport yang dirender ke DOM.
9. *(tambahan)* IF jumlah Member aktif dalam Club melebihi 100, THEN THE Web_Dashboard SHALL menampilkan indikator jumlah Member yang tidak terlihat dan menyediakan fitur pencarian Member berdasarkan nama untuk menavigasi ke Member tertentu.

---

### Persyaratan 14: Dashboard Real-Time Mobile (Member)

**User Story:** Sebagai Member, saya ingin melihat HR saya sendiri secara real-time di Mobile_App, agar saya dapat memantau intensitas latihan saya selama berolahraga.

#### Kriteria Penerimaan

1. WHILE Sesi aktif, THE Mobile_App SHALL menampilkan nilai HR terkini, zona HR saat ini, dan durasi Sesi yang sedang berjalan.
2. WHEN data HR baru diterima, THE Mobile_App SHALL memperbarui tampilan HR dalam waktu kurang dari 1 detik.
3. WHEN peringatan anomali diterima dari topik `fitsense/{club_id}/{user_id}/alerts`, THE Mobile_App SHALL menampilkan notifikasi peringatan dengan getaran (haptic feedback) dan suara peringatan.
4. THE Mobile_App SHALL berlangganan topik `fitsense/{club_id}/{user_id}/hr` miliknya sendiri untuk menerima konfirmasi data yang telah diproses server.

---

### Persyaratan 15: Isolasi Data Multi-Tenant

**User Story:** Sebagai operator platform, saya ingin memastikan data setiap club sepenuhnya terisolasi dari club lain, agar privasi dan keamanan data setiap tenant terjaga.

#### Kriteria Penerimaan

1. THE API_Server SHALL memastikan setiap query ke PostgreSQL menyertakan filter `club_id` yang sesuai dengan club pengguna yang terautentikasi, kecuali untuk Super_Admin.
2. THE API_Server SHALL memastikan setiap query ke InfluxDB menyertakan filter tag `club_id` yang sesuai.
3. IF pengguna mencoba mengakses data Member dari Club yang berbeda dengan Club-nya, THEN THE API_Server SHALL mengembalikan respons HTTP 403.
4. THE MQTT_Broker SHALL memastikan Trainer dan Club_Owner hanya dapat berlangganan topik dalam namespace `fitsense/{club_id}/#` sesuai `club_id` mereka masing-masing.
5. THE API_Server SHALL memvalidasi bahwa `clubId` pada URL path sesuai dengan `club_id` dalam JWT pengguna yang sedang login sebelum memproses setiap request.

---

### Persyaratan 16: Ketersediaan dan Kesehatan Layanan

**User Story:** Sebagai operator platform, saya ingin dapat memantau kesehatan semua layanan, agar saya dapat mendeteksi dan merespons gangguan layanan dengan cepat.

#### Kriteria Penerimaan

1. THE ML_Service SHALL menyediakan endpoint `GET /ml/health` yang mengembalikan status kesehatan layanan beserta status koneksi ke PostgreSQL dan InfluxDB.
2. WHEN ML_Service tidak dapat terhubung ke PostgreSQL atau InfluxDB, THE ML_Service SHALL mengembalikan status `degraded` pada endpoint health check dengan detail komponen yang bermasalah.
3. THE API_Server SHALL mengembalikan respons pada endpoint health check dalam waktu kurang dari 200ms.
4. IF Batch_Writer gagal melakukan flush ke InfluxDB selama lebih dari 10 siklus berturut-turut (10 detik), THEN THE Batch_Writer SHALL mencatat kondisi kritis ke log dan mengirimkan alert ke sistem monitoring.

---

### Persyaratan 17: Parser dan Serialisasi Payload MQTT

**User Story:** Sebagai platform, saya ingin memastikan payload MQTT yang diterima selalu dapat diparsing dan divalidasi dengan benar, agar data HR yang tidak valid tidak masuk ke sistem.

#### Kriteria Penerimaan

1. WHEN MQTT_Consumer menerima pesan pada topik HR, THE MQTT_Consumer SHALL mem-parsing payload JSON yang mengandung field `hr`, `rr`, `session_id`, dan `timestamp`.
2. IF payload yang diterima tidak dapat diparsing sebagai JSON yang valid, THEN THE MQTT_Consumer SHALL membuang pesan tersebut dan mencatat peringatan ke log dengan konten pesan yang gagal diparsing.
3. IF payload yang diterima tidak mengandung field wajib (`hr`, `session_id`, `timestamp`), THEN THE MQTT_Consumer SHALL membuang pesan tersebut dan mencatat peringatan ke log.
4. THE MQTT_Consumer SHALL memvalidasi bahwa nilai `hr` adalah bilangan bulat positif antara 20 hingga 300 bpm.
5. THE MQTT_Consumer SHALL memvalidasi bahwa nilai `rr` jika ada adalah bilangan desimal positif antara 200 hingga 2000 ms.
6. FOR ALL payload HR yang valid, serialisasi ulang payload tersebut ke JSON dan parsing kembali SHALL menghasilkan objek yang ekuivalen (round-trip property).

---

### Persyaratan 18: Registrasi Mandiri Member *(baru)*

**User Story:** Sebagai calon member gym, saya ingin dapat mendaftarkan diri sendiri ke platform FitSense menggunakan kode undangan club, agar saya tidak perlu menunggu Club_Owner untuk dibuatkan akun.

#### Kriteria Penerimaan

1. WHEN Club_Owner atau Trainer mengirimkan `POST /api/clubs/:clubId/invite`, THE API_Server SHALL menghasilkan kode undangan unik yang berlaku selama 7 hari dan mengembalikan kode tersebut beserta URL registrasi.
2. WHEN seorang calon member mengirimkan `POST /api/auth/register-member` dengan kode undangan yang valid, nama, email, password, dan usia, THE API_Server SHALL membuat akun Member baru yang terhubung ke Club pemilik kode undangan.
3. IF kode undangan yang dikirimkan tidak valid atau sudah kedaluwarsa, THEN THE API_Server SHALL mengembalikan respons HTTP 410 dengan pesan error yang menjelaskan bahwa kode tidak valid atau sudah habis masa berlakunya.
4. IF email yang digunakan untuk registrasi sudah terdaftar di platform, THEN THE API_Server SHALL mengembalikan respons HTTP 409.
5. THE API_Server SHALL memvalidasi password member baru memenuhi syarat minimum: panjang minimal 8 karakter, mengandung setidaknya satu huruf besar, satu huruf kecil, dan satu angka.
6. WHEN registrasi mandiri berhasil, THE API_Server SHALL menandai kode undangan sebagai sudah digunakan sehingga tidak dapat dipakai kembali oleh pengguna lain.
7. THE API_Server SHALL membatasi satu kode undangan hanya dapat digunakan oleh satu calon member.

---

### Persyaratan 19: Reset Password *(baru)*

**User Story:** Sebagai pengguna platform, saya ingin dapat mereset password saya jika lupa, agar saya dapat kembali mengakses akun saya tanpa bantuan administrator.

#### Kriteria Penerimaan

1. WHEN seorang pengguna mengirimkan `POST /api/auth/forgot-password` dengan email yang terdaftar, THE API_Server SHALL mengirimkan email berisi tautan reset password yang berlaku selama 1 jam ke alamat email tersebut.
2. IF email yang dikirimkan tidak terdaftar di platform, THEN THE API_Server SHALL tetap mengembalikan respons HTTP 200 dengan pesan generik tanpa mengungkapkan apakah email tersebut terdaftar atau tidak, untuk mencegah enumerasi akun.
3. WHEN seorang pengguna mengirimkan `POST /api/auth/reset-password` dengan token reset yang valid dan password baru yang memenuhi syarat, THE API_Server SHALL memperbarui password pengguna dan membatalkan semua sesi aktif pengguna tersebut.
4. IF token reset password yang dikirimkan tidak valid atau sudah kedaluwarsa, THEN THE API_Server SHALL mengembalikan respons HTTP 410.
5. THE API_Server SHALL memastikan token reset password hanya dapat digunakan satu kali. IF token yang sudah digunakan dikirimkan kembali, THEN THE API_Server SHALL mengembalikan respons HTTP 410.
6. THE API_Server SHALL membatasi permintaan reset password maksimal 3 kali dalam 1 jam per alamat email untuk mencegah penyalahgunaan.

---

### Persyaratan 20: Kebijakan Retensi Data HR *(baru)*

**User Story:** Sebagai operator platform, saya ingin mendefinisikan kebijakan penyimpanan data HR di InfluxDB, agar kapasitas storage dapat dikelola secara efisien dan sesuai kebutuhan bisnis.

#### Kriteria Penerimaan

1. THE System SHALL menyimpan data HR raw (interval 1 detik) di InfluxDB selama maksimal 90 hari sejak data ditulis.
2. WHEN data HR raw berusia lebih dari 90 hari, THE System SHALL secara otomatis menghapus data tersebut dari InfluxDB melalui retention policy yang dikonfigurasi pada bucket `heartrate`.
3. THE System SHALL menyimpan data HR yang telah diagregasi per menit (downsampled) selama maksimal 2 tahun untuk keperluan analisis tren jangka panjang.
4. THE System SHALL menjalankan proses downsampling secara otomatis setiap hari: mengagregasi data HR raw menjadi rata-rata per menit untuk data yang berusia lebih dari 90 hari dan menyimpannya ke bucket `heartrate_aggregated`.
5. WHEN Super_Admin mengirimkan `GET /api/admin/storage/stats`, THE API_Server SHALL mengembalikan informasi ukuran storage InfluxDB per club, jumlah data point, dan estimasi hari tersisa berdasarkan kapasitas yang tersedia.
6. IF ukuran total data InfluxDB melebihi 80% dari kapasitas storage yang dialokasikan, THEN THE System SHALL mencatat peringatan ke log monitoring dan mengirimkan notifikasi ke Super_Admin.