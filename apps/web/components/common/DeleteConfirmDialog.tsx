import React, { useState, useEffect } from "react";

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  mode: "soft" | "hard";
  entityType: "member" | "company" | "user";
  entityName: string;
  onConfirm: (confirmationName?: string) => void;
  onCancel: () => void;
  isBusy?: boolean;
}

export default function DeleteConfirmDialog({
  isOpen,
  mode,
  entityType,
  entityName,
  onConfirm,
  onCancel,
  isBusy = false,
}: DeleteConfirmDialogProps) {
  const [typedName, setTypedName] = useState("");

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setTypedName("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isMatched = typedName.trim() === entityName.trim();
  
  let label = "Company / Club";
  if (entityType === "member") {
    label = "Member";
  } else if (entityType === "user") {
    label = "User";
  }

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
          <span style={{ fontSize: "24px" }}>{mode === "hard" ? "🚨" : "⚠️"}</span>
          <h3
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: mode === "hard" ? "#dc2626" : "#d97706",
              margin: 0,
            }}
          >
            {mode === "hard" ? "Hapus Permanen" : `Nonaktifkan ${label}`}
          </h3>
        </div>

        <div style={{ marginBottom: "20px", fontSize: "14px", color: "#4b5563", lineHeight: "1.5" }}>
          {mode === "soft" ? (
            <>
              {entityType === "user" ? (
                <p style={{ margin: "0 0 12px 0" }}>
                  <strong>"{entityName}"</strong> akan dinonaktifkan. Data tetap ada dan bisa diaktifkan kembali.
                </p>
              ) : (
                <>
                  <p style={{ margin: "0 0 12px 0" }}>
                    Apakah Anda yakin ingin menonaktifkan <strong>{entityName}</strong>?
                  </p>
                  <div
                    style={{
                      backgroundColor: "#fef3c7",
                      border: "1px solid #fde68a",
                      color: "#92400e",
                      borderRadius: "8px",
                      padding: "12px 16px",
                      fontSize: "13px",
                    }}
                  >
                    <strong>Catatan:</strong> Member tidak akan bisa masuk ke sistem, namun semua data riwayat latihan tetap aman dan akun dapat diaktifkan kembali kapan saja oleh Club Owner.
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              <p style={{ margin: "0 0 12px 0" }}>
                Tindakan ini <strong>TIDAK BISA DIPULIHKAN</strong>. Seluruh data terkait {label.toLowerCase()} ini, termasuk:
              </p>
              {entityType === "user" ? (
                <ul style={{ margin: "0 0 16px 20px", padding: 0 }}>
                  <li>Semua sesi latihan</li>
                  <li>Data HR historis</li>
                  <li>Device terdaftar</li>
                </ul>
              ) : (
                <ul style={{ margin: "0 0 16px 20px", padding: 0 }}>
                  <li>Riwayat sesi latihan (snapshot biometrik)</li>
                  <li>Perangkat/sensor yang terdaftar</li>
                  <li>Penugasan program latihan (workout)</li>
                </ul>
              )}
              <p style={{ margin: "0 0 12px 0", fontWeight: 500, color: "#1f2937" }}>
                Ketik nama lengkap <strong>{entityName}</strong> di bawah untuk mengonfirmasi:
              </p>
              <input
                type="text"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Ketik nama di sini..."
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  marginBottom: "8px",
                }}
              />
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
          <button
            onClick={onCancel}
            disabled={isBusy}
            style={{
              padding: "8px 16px",
              backgroundColor: "transparent",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#374151",
              cursor: "pointer",
            }}
          >
            Batal
          </button>
          <button
            onClick={() => onConfirm(mode === "hard" ? typedName : undefined)}
            disabled={isBusy || (mode === "hard" && !isMatched)}
            style={{
              padding: "8px 16px",
              backgroundColor: mode === "hard" ? "#dc2626" : "#d97706",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: (isBusy || (mode === "hard" && !isMatched)) ? "not-allowed" : "pointer",
              opacity: (mode === "hard" && !isMatched) ? 0.5 : 1,
            }}
          >
            {isBusy ? "Memproses..." : mode === "hard" ? "Hapus Permanen" : "Nonaktifkan"}
          </button>
        </div>
      </div>
    </div>
  );
}
