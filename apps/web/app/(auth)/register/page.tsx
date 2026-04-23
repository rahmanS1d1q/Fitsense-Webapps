"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState } from "react";

const registerSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Harus mengandung huruf besar")
    .regex(/[a-z]/, "Harus mengandung huruf kecil")
    .regex(/[0-9]/, "Harus mengandung angka"),
  inviteCode: z.string().min(1, "Kode undangan wajib diisi"),
});

type RegisterForm = z.infer<typeof registerSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function RegisterPage() {
  const router = useRouter();
  const [successMsg, setSuccessMsg] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterForm) => {
    try {
      const res = await fetch(`${API_URL}/auth/register-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          inviteCode: data.inviteCode,
        }),
      });

      if (res.status === 410) {
        setError("inviteCode", {
          message: "Kode undangan tidak valid atau sudah kedaluwarsa",
        });
        return;
      }

      if (res.status === 409) {
        setError("email", { message: "Email sudah terdaftar di platform" });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError("root", {
          message: body?.error?.message ?? "Registrasi gagal",
        });
        return;
      }

      setSuccessMsg("Akun berhasil dibuat! Silakan login.");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("root", { message: "Terjadi kesalahan. Coba lagi." });
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Daftar Member</h1>

      {successMsg && (
        <p style={{ color: "green", marginBottom: 16 }}>{successMsg}</p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="name">Nama</label>
          <input
            id="name"
            type="text"
            {...register("name")}
            style={{
              display: "block",
              width: "100%",
              padding: 8,
              marginTop: 4,
            }}
          />
          {errors.name && (
            <p style={{ color: "red", fontSize: 12 }}>{errors.name.message}</p>
          )}
        </div>

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

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            {...register("password")}
            style={{
              display: "block",
              width: "100%",
              padding: 8,
              marginTop: 4,
            }}
          />
          {errors.password && (
            <p style={{ color: "red", fontSize: 12 }}>
              {errors.password.message}
            </p>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label htmlFor="inviteCode">Kode Undangan</label>
          <input
            id="inviteCode"
            type="text"
            {...register("inviteCode")}
            style={{
              display: "block",
              width: "100%",
              padding: 8,
              marginTop: 4,
            }}
          />
          {errors.inviteCode && (
            <p style={{ color: "red", fontSize: 12 }}>
              {errors.inviteCode.message}
            </p>
          )}
        </div>

        {errors.root && (
          <p style={{ color: "red", marginBottom: 12 }}>
            {errors.root.message}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          style={{ width: "100%", padding: 10 }}
        >
          {isSubmitting ? "Mendaftar..." : "Daftar"}
        </button>

        <p style={{ marginTop: 16, textAlign: "center" }}>
          Sudah punya akun? <a href="/login">Login</a>
        </p>
      </form>
    </div>
  );
}
