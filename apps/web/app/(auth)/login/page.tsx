"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email wajib diisi")
    .email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

type LoginForm = z.infer<typeof loginSchema>;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const msg = params.get("message");
      if (msg) {
        setInfoMessage(msg);
      }
    }
  }, []);

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
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 429)
          setError("root", {
            message: "Terlalu banyak percobaan. Coba lagi 15 menit lagi.",
          });
        else
          setError("root", {
            message: body?.error?.message ?? "Email atau password salah.",
          });
        return;
      }

      const { jwt, mqttToken, user } = await res.json();
      const role = user?.role;

      let mqttTokenExp = Date.now() + 30 * 60 * 1000;
      try {
        const payload = JSON.parse(atob(mqttToken.split(".")[1]));
        if (payload.exp) mqttTokenExp = payload.exp * 1000;
      } catch {
        /* */
      }

      if (typeof window !== "undefined") {
        sessionStorage.setItem("jwt", jwt);
        sessionStorage.setItem("mqttToken", mqttToken ?? "");
        sessionStorage.setItem("mqttTokenExp", String(mqttTokenExp));
        sessionStorage.setItem("role", role ?? "");
        sessionStorage.setItem("userId", user?.id ?? "");
        sessionStorage.setItem("companyId", user?.companyId ?? "");
        sessionStorage.setItem("email", user?.email ?? "");
        const displayName = user?.firstName
          ? `${user.firstName} ${user.lastName ?? ""}`.trim()
          : "User";
        sessionStorage.setItem("userName", displayName);
      }

      if (role === "super_admin") router.push("/dashboard/admin");
      else if (role === "trainer" || role === "club_owner")
        router.push("/dashboard/trainer");
      else router.push("/dashboard/member");
    } catch {
      setError("root", { message: "Tidak dapat terhubung ke server." });
    }
  };

  return (
    <div className="login-root">
      {/* Left side — typography only, no decoration */}
      <div className="login-left">
        <div className="login-mark">FitSense</div>

        <div className="login-content">
          <div className="login-eyebrow">01 / Sign in</div>
          <h1 className="login-h1">
            Heart rate
            <br />
            monitoring,
            <br />
            <em>simplified.</em>
          </h1>
          <p className="login-lede">
            Platform untuk pelatih dan pemilik gym memantau detak jantung member
            secara langsung.
          </p>
        </div>

        <div className="login-foot">
          <span>FitSense {new Date().getFullYear()}</span>
          <span>Versi 1.0</span>
        </div>
      </div>

      {/* Right side — form */}
      <div className="login-right">
        <div className="login-form-wrap">
          <div className="login-mobile-mark">FitSense</div>

          <h2 className="login-form-title">Masuk</h2>
          <p className="login-form-sub">
            Gunakan akun yang diberikan oleh gym kamu.
          </p>

          {infoMessage && (
            <div className="login-info-banner">
              {infoMessage}
            </div>
          )}

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="login-form"
          >
            <div className="login-field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="kamu@gym.com"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email && (
                <span className="login-error-msg">{errors.email.message}</span>
              )}
            </div>

            <div className="login-field">
              <div className="login-field-row">
                <label htmlFor="password">Password</label>
                <a href="/forgot-password" className="login-forgot">
                  Lupa?
                </a>
              </div>
              <div className="login-pwd">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  aria-invalid={!!errors.password}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Sembunyikan" : "Lihat"}
                >
                  {showPassword ? "Sembunyikan" : "Lihat"}
                </button>
              </div>
              {errors.password && (
                <span className="login-error-msg">
                  {errors.password.message}
                </span>
              )}
            </div>

            {errors.root && (
              <div className="login-error-root">{errors.root.message}</div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="login-submit"
            >
              {isSubmitting ? "Memuat..." : "Masuk →"}
            </button>
          </form>

          <p className="login-help">
            Belum punya akun? Hubungi pemilik atau pelatih gym untuk akses.
          </p>
        </div>
      </div>

      <style jsx>{`
        .login-root {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          background: #faf8f4;
          color: #1c1917;
          font-feature-settings: "ss01", "ss02";
        }

        /* ── Left ──────────────────────────────────────── */
        .login-left {
          background: #14110f;
          color: #faf8f4;
          padding: 40px 56px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }
        .login-mark {
          font-family: "Georgia", "Times New Roman", serif;
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
          font-style: italic;
        }
        .login-content {
          max-width: 520px;
          margin-bottom: 80px;
        }
        .login-eyebrow {
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 12px;
          letter-spacing: 0.05em;
          color: #a8a29e;
          margin-bottom: 28px;
          padding-top: 12px;
          border-top: 1px solid #44403c;
          width: fit-content;
          padding-right: 20px;
        }
        .login-h1 {
          font-family: "Georgia", "Times New Roman", serif;
          font-size: clamp(40px, 5vw, 64px);
          font-weight: 400;
          line-height: 1.05;
          letter-spacing: -0.025em;
          margin: 0 0 28px;
          color: #faf8f4;
        }
        .login-h1 em {
          font-style: italic;
          color: #d6d3d1;
        }
        .login-lede {
          font-size: 16px;
          line-height: 1.55;
          color: #a8a29e;
          max-width: 420px;
          margin: 0;
        }
        .login-foot {
          display: flex;
          justify-content: space-between;
          font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 11px;
          color: #78716c;
          letter-spacing: 0.04em;
        }

        /* ── Right ─────────────────────────────────────── */
        .login-right {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 32px;
        }
        .login-form-wrap {
          width: 100%;
          max-width: 380px;
        }
        .login-mobile-mark {
          display: none;
          font-family: "Georgia", "Times New Roman", serif;
          font-size: 20px;
          font-style: italic;
          margin-bottom: 32px;
          color: #1c1917;
        }
        .login-form-title {
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0 0 6px;
          color: #1c1917;
        }
        .login-form-sub {
          margin: 0 0 36px;
          font-size: 14px;
          color: #78716c;
          line-height: 1.5;
        }

        /* ── Form fields ───────────────────────────────── */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .login-field {
          display: flex;
          flex-direction: column;
        }
        .login-field-row {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 6px;
        }
        .login-field label {
          font-size: 12px;
          font-weight: 600;
          color: #57534e;
          letter-spacing: 0.01em;
        }
        .login-field > label {
          margin-bottom: 6px;
        }
        .login-forgot {
          font-size: 12px;
          color: #78716c;
          text-decoration: none;
          font-weight: 500;
        }
        .login-forgot:hover {
          color: #1c1917;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .login-field input {
          width: 100%;
          padding: 10px 0;
          background: transparent;
          border: none;
          border-bottom: 1px solid #d6d3d1;
          font-size: 15px;
          color: #1c1917;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .login-field input::placeholder {
          color: #a8a29e;
        }
        .login-field input:focus {
          border-bottom-color: #1c1917;
        }
        .login-field input[aria-invalid="true"] {
          border-bottom-color: #b91c1c;
        }

        .login-pwd {
          position: relative;
        }
        .login-pwd input {
          padding-right: 90px;
        }
        .login-pwd button {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          font-size: 12px;
          color: #78716c;
          cursor: pointer;
          padding: 4px 0;
          font-weight: 500;
        }
        .login-pwd button:hover {
          color: #1c1917;
        }

        .login-error-msg {
          margin-top: 6px;
          font-size: 12px;
          color: #b91c1c;
        }
        .login-error-root {
          padding: 10px 14px;
          background: #fef2f2;
          border-left: 2px solid #b91c1c;
          font-size: 13px;
          color: #7f1d1d;
        }
        .login-info-banner {
          padding: 10px 14px;
          background: #f0fdf4;
          border-left: 2px solid #16a34a;
          font-size: 13px;
          color: #14532d;
          margin-bottom: 20px;
        }

        /* ── Submit ────────────────────────────────────── */
        .login-submit {
          margin-top: 8px;
          padding: 13px 20px;
          background: #1c1917;
          color: #faf8f4;
          border: none;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .login-submit:hover:not(:disabled) {
          background: #292524;
        }
        .login-submit:disabled {
          background: #a8a29e;
          cursor: not-allowed;
        }

        .login-help {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #e7e5e4;
          font-size: 12px;
          color: #78716c;
          line-height: 1.6;
        }

        /* ── Mobile ────────────────────────────────────── */
        @media (max-width: 860px) {
          .login-root {
            grid-template-columns: 1fr;
          }
          .login-left {
            display: none;
          }
          .login-mobile-mark {
            display: block;
          }
        }
      `}</style>
    </div>
  );
}
