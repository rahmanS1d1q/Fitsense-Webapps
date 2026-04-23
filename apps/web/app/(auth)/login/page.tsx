"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginForm = z.infer<typeof loginSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError("root", {
          message: body?.error?.message ?? "Email atau password salah",
        });
        return;
      }

      const { token, mqttToken, role } = await res.json();

      // Store tokens in memory / sessionStorage for MQTT usage
      if (typeof window !== "undefined") {
        sessionStorage.setItem("jwt", token);
        sessionStorage.setItem("mqttToken", mqttToken);
        sessionStorage.setItem("role", role);
      }

      // Redirect based on role
      if (role === "super_admin") {
        router.push("/dashboard/admin");
      } else if (role === "trainer" || role === "club_owner") {
        router.push("/dashboard/trainer");
      } else {
        router.push("/dashboard/member");
      }
    } catch {
      setError("root", { message: "Terjadi kesalahan. Coba lagi." });
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: 24 }}>
      <h1 style={{ marginBottom: 24 }}>Login FitSense</h1>
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
          {isSubmitting ? "Memproses..." : "Login"}
        </button>

        <p style={{ marginTop: 16, textAlign: "center" }}>
          <a href="/forgot-password">Lupa password?</a>
        </p>
        <p style={{ marginTop: 8, textAlign: "center" }}>
          Belum punya akun? <a href="/register">Daftar dengan kode undangan</a>
        </p>
      </form>
    </div>
  );
}
