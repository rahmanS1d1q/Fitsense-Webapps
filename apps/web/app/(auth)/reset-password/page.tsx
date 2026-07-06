"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { passwordSchema } from "../../../lib/schemas/password";

const schema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

type Form = z.infer<typeof schema>;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: Form) => {
    const res = await fetch(`${API_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword: data.newPassword }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError("root", {
        message: body?.error?.message ?? "Token tidak valid atau sudah expired",
      });
      return;
    }
    setDone(true);
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
            Reset Password
          </h1>
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
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <h2 style={{ margin: "0 0 8px", fontSize: 18, color: "#111827" }}>
                Password Berhasil Diubah
              </h2>
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
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="newPassword"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Password Baru
                </label>
                <input
                  id="newPassword"
                  type="password"
                  placeholder="Min. 8 karakter"
                  {...register("newPassword")}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.newPassword
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {errors.newPassword && (
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.newPassword.message}
                  </p>
                )}
              </div>
              <div style={{ marginBottom: 20 }}>
                <label
                  htmlFor="confirmPassword"
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#374151",
                  }}
                >
                  Konfirmasi Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Ulangi password baru"
                  {...register("confirmPassword")}
                  style={{
                    width: "100%",
                    padding: "11px 14px",
                    border: errors.confirmPassword
                      ? "1.5px solid #dc2626"
                      : "1.5px solid #e5e7eb",
                    borderRadius: 10,
                    fontSize: 15,
                    boxSizing: "border-box",
                    background: "#f9fafb",
                  }}
                />
                {errors.confirmPassword && (
                  <p
                    style={{
                      margin: "5px 0 0",
                      fontSize: 12,
                      color: "#dc2626",
                    }}
                  >
                    {errors.confirmPassword.message}
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
                {isSubmitting ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordForm />
    </Suspense>
  );
}
