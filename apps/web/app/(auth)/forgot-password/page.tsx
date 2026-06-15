"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

const schema = z.object({ email: z.string().email("Email tidak valid") });
type Form = z.infer<typeof schema>;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSent(true);
  };

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
            Lupa Password
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#94a3b8" }}>
            Masukkan email untuk reset password
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
          {sent ? (
            <div style={{ textAlign: "center", padding: "20px 0" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#111827" }}>
                Email Terkirim
              </h2>
              <p style={{ color: "#6b7280", fontSize: 14 }}>
                Jika email terdaftar, kamu akan menerima link reset password.
              </p>
              <a
                href="/login"
                style={{
                  display: "inline-block",
                  marginTop: 20,
                  fontSize: 14,
                  color: "#2563eb",
                  fontWeight: 500,
                }}
              >
                ← Kembali ke Login
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div style={{ marginBottom: 20 }}>
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
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="nama@email.com"
                  {...register("email")}
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
                      margin: "5px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.email.message}
                  </p>
                )}
              </div>
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
                {isSubmitting ? "Mengirim..." : "Kirim Link Reset"}
              </button>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 14 }}>
                <a href="/login" style={{ color: "#2563eb" }}>
                  ← Kembali ke Login
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
