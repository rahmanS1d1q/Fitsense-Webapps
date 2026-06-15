"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const jwt =
      typeof window !== "undefined" ? sessionStorage.getItem("jwt") : null;
    if (jwt) {
      const role = sessionStorage.getItem("role");
      if (role === "super_admin") router.replace("/dashboard/admin");
      else if (role === "trainer" || role === "club_owner")
        router.replace("/dashboard/trainer");
      else router.replace("/dashboard/member");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f172a",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: "linear-gradient(135deg, #3b82f6, #06b6d4)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <p style={{ color: "#94a3b8", fontSize: 14 }}>Memuat...</p>
      </div>
    </div>
  );
}
