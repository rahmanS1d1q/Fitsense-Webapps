-- FitSense Schema v2 — Catatan perubahan dari schema awal
-- File ini mendokumentasikan perubahan yang sudah diterapkan langsung di pgAdmin.
-- Jalankan hanya jika database masih menggunakan schema lama (clubs, role di users, dll).

-- ============================================================
-- Jika database sudah diupdate manual via pgAdmin, SKIP file ini.
-- Schema aktual sudah sesuai dengan 001_initial_schema.sql.
-- ============================================================

-- Perubahan yang sudah diterapkan:
-- 1. clubs → companies (rename tabel)
-- 2. users: hapus club_id, name; tambah first_name, last_name, bio_code, height, weight, updated_at
-- 3. users.role: sekarang NOT NULL DEFAULT 'member' (semua role tersimpan di sini)
-- 4. Tabel baru: users_companies, assets, workouts, heart_rate
-- 5. sessions: club_id → company_id, tambah workout_id, mood
-- 6. devices: club_id → company_id, hanya coospo_hw706
-- 7. invite_codes: club_id → company_id, company_id dan created_by NOT NULL
-- 8. ml_recommendations: user_id dan session_id NOT NULL
-- 9. Hapus tabel: instructions, instructions_in_workouts

-- Untuk fresh install, gunakan 001_initial_schema.sql + 002_seed_super_admin.sql
