"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  addCompanyDeviceSchema,
  AddCompanyDeviceForm,
} from "../../../../../lib/schemas/addCompanyDeviceSchema";
import FormInput from "../../../../../components/forms/FormInput";
import FormCard from "../../../../../components/forms/FormCard";
import SubmitButton from "../../../../../components/forms/SubmitButton";
import MacAddressInput from "../../../../../components/devices/MacAddressInput";
import Navbar from "../../../../../components/Navbar";
import { apiPost, getCompanyId } from "../../../../../lib/api";

export default function NewCompanyDevicePage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<AddCompanyDeviceForm>({
    resolver: zodResolver(addCompanyDeviceSchema),
  });

  const onSubmit = async (data: AddCompanyDeviceForm) => {
    const companyId = getCompanyId();
    if (!companyId) {
      router.push("/login");
      return;
    }

    const {
      ok,
      status,
      data: res,
    } = await apiPost(`/companies/${companyId}/devices/company`, {
      name: data.name,
      device_type: data.device_type,
      mac_address: data.mac_address,
      notes: data.notes || undefined,
      assigned_to: data.assigned_to || undefined,
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
    router.push("/dashboard/owner/devices");
  };

  return (
    <>
      <Navbar />
      <FormCard
        title="Tambah Device Company"
        subtitle="Daftarkan sensor milik gym"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInput
            id="name"
            label="Nama Device"
            required
            register={register("name")}
            error={errors.name?.message}
            placeholder="Contoh: Sensor #1"
          />

          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="device_type"
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "#374151",
              }}
            >
              Tipe Device <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              id="device_type"
              {...register("device_type")}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: errors.device_type
                  ? "1.5px solid #dc2626"
                  : "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 14,
                boxSizing: "border-box",
                background: "#fff",
              }}
            >
              <option value="coospo_hw706">Coospo HW706</option>
            </select>
            {errors.device_type && (
              <p style={{ margin: "5px 0 0", fontSize: 12, color: "#dc2626" }}>
                {errors.device_type.message}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="mac_address"
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "#374151",
              }}
            >
              MAC Address <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <Controller
              name="mac_address"
              control={control}
              defaultValue=""
              render={({ field }) => (
                <MacAddressInput
                  id="mac_address"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.mac_address?.message}
                />
              )}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="notes"
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "#374151",
              }}
            >
              Catatan
            </label>
            <textarea
              id="notes"
              {...register("notes")}
              placeholder="Catatan opsional..."
              rows={3}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1.5px solid #e5e7eb",
                borderRadius: 8,
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          {errors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {errors.root.message}
            </p>
          )}
          <SubmitButton label="Daftarkan Device" loading={isSubmitting} />
        </form>
      </FormCard>
    </>
  );
}
