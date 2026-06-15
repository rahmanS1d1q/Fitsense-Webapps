"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Navbar from "../../../../../../components/Navbar";
import MacAddressInput from "../../../../../../components/devices/MacAddressInput";
import {
  addUserDeviceSchema,
  AddUserDeviceForm,
} from "../../../../../../lib/schemas/addUserDeviceSchema";
import {
  apiGet,
  apiPost,
  getCompanyId,
  getAuthHeaders,
} from "../../../../../../lib/api";

interface Device {
  id: string;
  name: string | null;
  mac_address: string;
  device_type: string;
  registered_at: string;
}
interface Member {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export default function OwnerMemberDevicesPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.userId as string;
  const [devices, setDevices] = useState<Device[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMsg, setFormMsg] = useState("");

  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AddUserDeviceForm>({
    resolver: zodResolver(addUserDeviceSchema),
  });

  const load = useCallback(async () => {
    const companyId = getCompanyId();
    if (!companyId) return;
    const [devRes, memRes] = await Promise.all([
      apiGet(`/companies/${companyId}/members/${userId}/devices`),
      apiGet(`/companies/${companyId}/members/${userId}`),
    ]);
    if (devRes.ok) setDevices(devRes.data.devices ?? []);
    if (memRes.ok) setMember(memRes.data.member);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onSubmit = async (data: AddUserDeviceForm) => {
    const companyId = getCompanyId();
    const {
      ok,
      status,
      data: res,
    } = await apiPost(`/companies/${companyId}/members/${userId}/devices`, {
      device_type: data.device_type,
      mac_address: data.mac_address,
      name: data.name || undefined,
    });
    if (!ok) {
      if (status === 409)
        setError("mac_address", {
          message: res?.error?.message ?? "MAC address sudah terdaftar",
        });
      else
        setError("root", {
          message: res?.error?.message ?? "Gagal mendaftarkan device",
        });
      return;
    }
    setFormMsg("Device berhasil didaftarkan");
    reset();
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus device ini?")) return;
    const companyId = getCompanyId();
    const res = await fetch(
      `${API_URL}/companies/${companyId}/members/${userId}/devices/${id}`,
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      },
    );
    if (res.ok) load();
    else alert("Gagal menghapus device");
  };

  const name = member
    ? `${member.first_name} ${member.last_name}`.trim()
    : "Member";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <div style={{ padding: "28px 24px", maxWidth: 720, margin: "0 auto" }}>
        <button
          onClick={() => router.back()}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            fontSize: 14,
            marginBottom: 20,
          }}
        >
          ← Kembali
        </button>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
              Device Pribadi
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "#64748b" }}>
              {name} · {member?.email}
            </p>
          </div>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setFormMsg("");
            }}
            style={{
              padding: "9px 18px",
              background: showForm ? "#6b7280" : "#2563eb",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {showForm ? "✕ Tutup" : "+ Tambah Device"}
          </button>
        </div>

        {formMsg && (
          <div
            style={{
              padding: "10px 14px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 14,
              color: "#16a34a",
            }}
          >
            {formMsg}
          </div>
        )}

        {showForm && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 600 }}>
              Daftarkan Device Baru
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  Tipe Device *
                </label>
                <select
                  {...register("device_type")}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                >
                  <option value="coospo_hw706">Coospo HW706</option>
                </select>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  MAC Address *
                </label>
                <Controller
                  name="mac_address"
                  control={control}
                  defaultValue=""
                  render={({ field }) => (
                    <MacAddressInput
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.mac_address?.message}
                    />
                  )}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: 6,
                    fontWeight: 500,
                    fontSize: 13,
                    color: "#374151",
                  }}
                >
                  Nama Device
                </label>
                <input
                  {...register("name")}
                  placeholder="Opsional"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    border: "1.5px solid #e5e7eb",
                    borderRadius: 8,
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              {errors.root && (
                <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
                  {errors.root.message}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "10px 24px",
                  background: isSubmitting ? "#94a3b8" : "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {isSubmitting ? "Menyimpan..." : "Daftarkan"}
              </button>
            </form>
          </div>
        )}

        {devices.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <p style={{ color: "#94a3b8", fontSize: 14 }}>
              Belum ada device terdaftar
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Nama", "MAC Address", "Tipe", "Terdaftar", ""].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 14px",
                        textAlign: "left",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "#64748b",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 14,
                        fontWeight: 500,
                      }}
                    >
                      {d.name ?? <span style={{ color: "#94a3b8" }}>—</span>}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 13,
                        fontFamily: "monospace",
                      }}
                    >
                      {d.mac_address}
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 13,
                        color: "#64748b",
                      }}
                    >
                      Coospo HW706
                    </td>
                    <td
                      style={{
                        padding: "12px 14px",
                        fontSize: 13,
                        color: "#94a3b8",
                      }}
                    >
                      {new Date(d.registered_at).toLocaleDateString("id-ID")}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "right" }}>
                      <button
                        onClick={() => handleDelete(d.id)}
                        style={{
                          padding: "4px 12px",
                          background: "#fef2f2",
                          color: "#dc2626",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                          fontSize: 12,
                        }}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
