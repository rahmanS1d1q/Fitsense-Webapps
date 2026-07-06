"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { passwordSchema } from "../../../lib/schemas/password";

const schema = z.object({
  firstName: z.string().min(1, "Nama depan wajib diisi"),
  lastName: z.string().min(1, "Nama belakang wajib diisi"),
  email: z.string().email("Email tidak valid"),
  password: passwordSchema,
  date_of_birth: z.string({ required_error: "Tanggal lahir wajib diisi" })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal lahir: YYYY-MM-DD')
    .refine((val) => {
      const date = new Date(val);
      const today = new Date();
      let age = today.getFullYear() - date.getFullYear();
      const m = today.getMonth() - date.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
        age--;
      }
      return age >= 10 && age <= 100;
    }, 'Usia harus antara 10 dan 100 tahun'),
});

type Form = z.infer<typeof schema>;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite") ?? "";
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const dateOfBirth = watch("date_of_birth");
  const getCalculatedAge = (dobString: string) => {
    if (!dobString) return null;
    const date = new Date(dobString);
    if (isNaN(date.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age;
  };
  const calculatedAge = getCalculatedAge(dateOfBirth);

  const onSubmit = async (data: Form) => {
    if (!inviteCode) {
      setError("root", { message: "Kode undangan tidak ditemukan di URL" });
      return;
    }

    const res = await fetch(`${API_URL}/auth/register-member`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: inviteCode,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        date_of_birth: data.date_of_birth,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (res.status === 409)
        setError("email", { message: "Email sudah terdaftar" });
      else if (res.status === 410)
        setError("root", {
          message: "Kode undangan tidak valid atau sudah expired",
        });
      else
        setError("root", {
          message: body?.error?.message ?? "Terjadi kesalahan",
        });
      return;
    }
    setDone(true);
  };

  if (!inviteCode) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 40,
            maxWidth: 400,
            textAlign: "center",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>
            Kode Undangan Diperlukan
          </h2>
          <p style={{ color: "#6b7280", fontSize: 14 }}>
            Hubungi trainer atau admin gym kamu untuk mendapatkan link
            pendaftaran.
          </p>
          <a
            href="/login"
            style={{
              display: "inline-block",
              marginTop: 20,
              color: "#2563eb",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            ← Kembali ke Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
              marginBottom: 16,
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <h1
            style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fff" }}
          >
            Daftar Member
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#94a3b8" }}>
            Buat akun dengan kode undangan
          </p>
        </div>

        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "36px 32px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}
        >
          {done ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#111827" }}>
                Pendaftaran Berhasil!
              </h2>
              <p style={{ color: "#6b7280", fontSize: 14 }}>
                Akun kamu sudah aktif. Silakan login.
              </p>
              <a
                href="/login"
                style={{
                  display: "inline-block",
                  marginTop: 16,
                  padding: "10px 24px",
                  background: "#2563eb",
                  color: "#fff",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                Login Sekarang
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="firstName"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Nama Depan *
                </label>
                <input
                  id="firstName"
                  {...register("firstName")}
                  placeholder="Siti"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.firstName
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {errors.firstName && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="lastName"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Nama Belakang *
                </label>
                <input
                  id="lastName"
                  {...register("lastName")}
                  placeholder="Rahayu"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.lastName
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {errors.lastName && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.lastName.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Email *
                </label>
                <input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="email@contoh.com"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.email
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {errors.email && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Password *
                </label>
                <input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="Min. 8 karakter"
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.password
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {errors.password && (
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="date_of_birth"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Tanggal Lahir *
                </label>
                <input
                  id="date_of_birth"
                  type="date"
                  {...register("date_of_birth")}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.date_of_birth
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {calculatedAge !== null && !errors.date_of_birth && (
                  <p style={{ margin: "6px 0 0", fontSize: 13, color: "#4b5563" }}>
                    Usia saat ini: <strong>{calculatedAge} tahun</strong> (dihitung otomatis)
                  </p>
                )}
                {errors.date_of_birth && (
                  <p
                     style={{
                       margin: "4px 0 0",
                       fontSize: 12,
                       color: "#dc2626",
                     }}
                  >
                    {errors.date_of_birth.message}
                  </p>
                )}
              </div>
              {errors.root && (
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#fef2f2",
                    border: "1px solid #fecaca",
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, color: "#dc2626" }}>
                    {errors.root.message}
                  </p>
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: "100%",
                  padding: "12px 24px",
                  background: isSubmitting
                    ? "#93c5fd"
                    : "linear-gradient(135deg, #3b82f6, #2563eb)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  boxShadow: "0 4px 14px rgba(37,99,235,0.3)",
                }}
              >
                {isSubmitting ? "Mendaftar..." : "Daftar"}
              </button>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
                <a href="/login" style={{ color: "#2563eb" }}>
                  Sudah punya akun? Login
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%)",
          }}
        >
          <div style={{ color: "#fff", fontSize: 16 }}>Memuat...</div>
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
