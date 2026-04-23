"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

const forgotSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

type ForgotForm = z.infer<typeof forgotSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

// Generic success message — never reveal whether email is registered (anti-enumeration)
const GENERIC_SUCCESS =
  "Jika email Anda terdaftar, kami telah mengirimkan tautan reset password. Periksa kotak masuk Anda.";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (data: ForgotForm) => {
    // Always show generic success regardless of API response (anti-enumeration)
    await fetch(`${API_URL}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: data.email }),
    }).catch(() => {
      // Silently ignore errors — still show generic success
    });

    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
        <h1 style={{ marginBottom: 24 }}>Reset Password</h1>
        <p style={{ color: "green" }}>{GENERIC_SUCCESS}</p>
        <p style={{ marginTop: 16 }}>
          <a href="/login">Kembali ke Login</a>
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Lupa Password</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            {...register("email")}
            style={{
              display: "block",
              width: "100%",
              padding: 8,
              marginTop: 4,
            }}
          />
          {errors.email && (
            <p style={{ color: "red", fontSize: 12 }}>{errors.email.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ width: "100%", padding: 10 }}
        >
          {isSubmitting ? "Mengirim..." : "Kirim Tautan Reset"}
        </button>

        <p style={{ marginTop: 16, textAlign: "center" }}>
          <a href="/login">Kembali ke Login</a>
        </p>
      </form>
    </div>
  );
}
