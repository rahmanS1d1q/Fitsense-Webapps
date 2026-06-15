"use client";

import React, { useState } from "react";
import Navbar from "../../../../components/Navbar";
import FormCard from "../../../../components/forms/FormCard";
import SubmitButton from "../../../../components/forms/SubmitButton";
import { apiPost, getCompanyId } from "../../../../lib/api";

interface InviteResult {
  code: string;
  registrationUrl: string;
  expiresAt: string;
}

export default function InvitePage() {
  const [result, setResult] = useState<InviteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setError("");
    setResult(null);
    setCopied(false);
    const companyId = getCompanyId();
    if (!companyId) {
      setError("Tidak ada companyId. Silakan login ulang.");
      return;
    }

    setLoading(true);
    const { ok, data } = await apiPost(`/companies/${companyId}/invite`, {});
    setLoading(false);

    if (!ok) {
      setError(data?.error?.message ?? "Gagal generate kode undangan");
      return;
    }

    setResult(data);
  };

  const handleCopy = () => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />
      <FormCard
        title="Generate Kode Undangan"
        subtitle="Buat kode undangan untuk member baru. Berlaku 7 hari, sekali pakai."
      >
        <div>
          <SubmitButton
            label={loading ? "Generating..." : "Generate Kode Undangan"}
            loading={loading}
          />

          {error && (
            <p style={{ color: "#dc2626", fontSize: 14, marginTop: 12 }}>
              {error}
            </p>
          )}

          {result && (
            <div
              style={{
                marginTop: 24,
                padding: 20,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
              }}
            >
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7280" }}>
                Kode Undangan:
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code
                  style={{
                    flex: 1,
                    padding: "10px 14px",
                    background: "#fff",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    fontSize: 13,
                    wordBreak: "break-all",
                    fontFamily: "monospace",
                  }}
                >
                  {result.code}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  style={{
                    padding: "8px 16px",
                    background: copied ? "#059669" : "#2563eb",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {copied ? "Tersalin!" : "Copy"}
                </button>
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>
                <p style={{ margin: "4px 0" }}>
                  Berlaku sampai:{" "}
                  <strong>
                    {new Date(result.expiresAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </strong>
                </p>
                <p style={{ margin: "4px 0" }}>
                  Status:{" "}
                  <span style={{ color: "#059669", fontWeight: 600 }}>
                    Belum dipakai
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </FormCard>
    </div>
  );
}
