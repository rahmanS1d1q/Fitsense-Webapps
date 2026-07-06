import React from "react";

interface BiometricConfirmDialogProps {
  isOpen: boolean;
  changes: {
    weight?: { current: number; new: number } | null;
    height?: { current: number; new: number } | null;
  };
  onConfirm: (updateProfile: boolean) => void;
  onCancel: () => void;
}

export default function BiometricConfirmDialog({
  isOpen,
  changes,
  onConfirm,
  onCancel,
}: BiometricConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "440px",
          padding: "24px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
          animation: "scaleIn 0.2s ease-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
          <span style={{ fontSize: "24px" }}>⚠️</span>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "#111827",
              margin: 0,
            }}
          >
            Perubahan Data Terdeteksi
          </h3>
        </div>

        <div style={{ marginBottom: "20px", fontSize: "14px", color: "#4b5563", lineHeight: "1.5" }}>
          <p style={{ margin: "0 0 16px 0" }}>
            Data berat atau tinggi badan yang Anda masukkan berbeda dengan data profil Anda saat ini:
          </p>

          {/* Weight Change */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "12px",
              border: "1px solid #f3f4f6",
            }}
          >
            <div style={{ fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Berat Badan:</div>
            {changes.weight ? (
              <div>
                Sebelumnya: <span style={{ textDecoration: "line-through" }}>{changes.weight.current} kg</span> →{" "}
                <strong style={{ color: "#2563eb" }}>{changes.weight.new} kg</strong>
              </div>
            ) : (
              <div style={{ color: "#9ca3af" }}>Tidak ada perubahan (Tetap)</div>
            )}
          </div>

          {/* Height Change */}
          <div
            style={{
              backgroundColor: "#f9fafb",
              borderRadius: "8px",
              padding: "12px 16px",
              marginBottom: "20px",
              border: "1px solid #f3f4f6",
            }}
          >
            <div style={{ fontWeight: 600, color: "#374151", marginBottom: "4px" }}>Tinggi Badan:</div>
            {changes.height ? (
              <div>
                Sebelumnya: <span style={{ textDecoration: "line-through" }}>{changes.height.current} cm</span> →{" "}
                <strong style={{ color: "#2563eb" }}>{changes.height.new} cm</strong>
              </div>
            ) : (
              <div style={{ color: "#9ca3af" }}>Tidak ada perubahan (Tetap)</div>
            )}
          </div>

          <p style={{ fontWeight: 500, color: "#1f2937", margin: "0 0 12px 0" }}>
            Apakah Anda ingin memperbarui profil Anda dengan data baru ini?
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button
            onClick={() => onConfirm(true)}
            style={{
              width: "100%",
              padding: "10px 16px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "14px",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#1d4ed8")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#2563eb")}
          >
            Ya, perbarui profil juga
          </button>
          <button
            onClick={() => onConfirm(false)}
            style={{
              width: "100%",
              padding: "10px 16px",
              backgroundColor: "#f3f4f6",
              color: "#374151",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "background-color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#e5e7eb")}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#f3f4f6")}
          >
            Tidak, hanya sesi ini
          </button>
          <button
            onClick={onCancel}
            style={{
              width: "100%",
              padding: "10px 16px",
              backgroundColor: "transparent",
              color: "#9ca3af",
              border: "none",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#4b5563")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#9ca3af")}
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
