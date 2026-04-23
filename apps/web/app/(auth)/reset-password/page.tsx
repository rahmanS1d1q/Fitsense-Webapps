"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

const resetSchema = z.object({
  password: z
    .string()
    .min(8, "Password minimal 8 karakter")
    .regex(/[A-Z]/, "Harus mengandung huruf besar")
    .regex(/[a-z]/, "Harus mengandung huruf kecil")
    .regex(/[0-9]/, "Harus mengandung angka"),
});

type ResetForm = z.infer<typeof resetSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });

  const onSubmit = async (data: ResetForm) => {
    if (!token) {
      setError("root", { message: "Token reset tidak ditemukan di URL" });
      return;
    }

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });

      if (res.status === 410) {
        setError("root", {
          message:
            "Token tidak valid atau sudah kedaluwarsa. Minta tautan reset baru.",
        });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError("root", {
          message: body?.error?.message ?? "Reset password gagal",
        });
        return;
      }

      router.push("/login?reset=success");
    } catch {
      setError("root", { message: "Terjadi kesalahan. Coba lagi." });
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Reset Password</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="password">Password Baru</label>
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
          {isSubmitting ? "Menyimpan..." : "Simpan Password Baru"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Memuat...</div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
