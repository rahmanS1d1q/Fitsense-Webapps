"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../../../components/Navbar";
import FormCard from "../../../../../components/forms/FormCard";
import { getCompanyId } from "../../../../../lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function UploadAssetPage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState("workout_image");
  const [name, setName] = useState("");
  const [published, setPublished] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Pilih file untuk diupload");
      return;
    }

    const companyId = getCompanyId();
    if (!companyId) {
      router.push("/login");
      return;
    }

    const jwt =
      typeof window !== "undefined" ? sessionStorage.getItem("jwt") : null;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);
    formData.append("name", name || file.name);
    formData.append("published", String(published));

    setUploading(true);
    setProgress(30);

    try {
      const res = await fetch(`${API_URL}/companies/${companyId}/assets`, {
        method: "POST",
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
        body: formData,
      });
      setProgress(90);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error?.message ?? `Error ${res.status}`);
        return;
      }
      setProgress(100);
      router.push("/dashboard/owner/assets");
    } catch {
      setError("Gagal upload. Coba lagi.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <FormCard
        title="Upload Asset"
        subtitle="Upload gambar atau video untuk workout dan profil"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: "block",
                marginBottom: 5,
                fontWeight: 500,
                fontSize: 14,
                color: "#374151",
              }}
            >
              File <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div
              style={{
                border: "2px dashed #d1d5db",
                borderRadius: 10,
                padding: "24px 16px",
                textAlign: "center",
                cursor: "pointer",
                background: file ? "#f0fdf4" : "#f9fafb",
              }}
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              <input
                id="fileInput"
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
                accept=".jpg,.jpeg,.png,.webp,.mp4"
              />
              {file ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "#059669",
                    fontWeight: 500,
                  }}
                >
                  {file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)
                </p>
              ) : (
                <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
                  Klik untuk pilih file (jpg, png, webp, mp4)
                </p>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="type"
              style={{
                display: "block",
                marginBottom: 5,
                fontWeight: 500,
                fontSize: 14,
                color: "#374151",
              }}
            >
              Tipe <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              id="type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
              }}
            >
              <option value="workout_image">Workout Image</option>
              <option value="workout_video">Workout Video</option>
              <option value="profile_photo">Profile Photo</option>
              <option value="club_banner">Club Banner</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="name"
              style={{
                display: "block",
                marginBottom: 5,
                fontWeight: 500,
                fontSize: 14,
                color: "#374151",
              }}
            >
              Nama (opsional)
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Default: nama file asli"
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <span style={{ fontSize: 14, color: "#374151" }}>
                Published (langsung terlihat)
              </span>
            </label>
          </div>

          {progress > 0 && progress < 100 && (
            <div
              style={{
                marginBottom: 16,
                background: "#e2e8f0",
                borderRadius: 4,
                height: 6,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: "100%",
                  background: "#2563eb",
                  transition: "width 0.3s",
                }}
              />
            </div>
          )}

          {error && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={uploading}
            style={{
              width: "100%",
              padding: "11px 24px",
              background: uploading
                ? "#93c5fd"
                : "linear-gradient(135deg, #7c3aed, #6d28d9)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: uploading ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 15,
            }}
          >
            {uploading ? "Mengupload..." : "Upload"}
          </button>
        </form>
      </FormCard>
    </div>
  );
}
