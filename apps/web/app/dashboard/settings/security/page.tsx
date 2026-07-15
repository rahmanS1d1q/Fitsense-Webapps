"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePasswordSchema,
  ChangePasswordForm,
} from "../../../../lib/schemas/changePasswordSchema";
import PasswordInput from "../../../../components/forms/PasswordInput";
import FormCard from "../../../../components/forms/FormCard";
import SubmitButton from "../../../../components/forms/SubmitButton";
import Navbar from "../../../../components/Navbar";
import { apiPost } from "../../../../lib/api";

export default function SecuritySettingsPage() {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    const { ok, data: res } = await apiPost("/auth/change-password", {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
      confirmPassword: data.confirmPassword,
    });

    if (!ok) {
      const errorMsg = res?.error?.message ?? "Password lama salah atau data tidak valid";
      if (errorMsg.toLowerCase().includes("baru tidak boleh sama")) {
        setError("newPassword", { message: errorMsg });
      } else if (errorMsg.toLowerCase().includes("konfirmasi")) {
        setError("confirmPassword", { message: errorMsg });
      } else {
        setError("currentPassword", { message: errorMsg });
      }
      return;
    }

    if (typeof window !== "undefined") {
      sessionStorage.clear();
      localStorage.clear();
    }
    const successMsg = "Password changed successfully. Please login again.";
    router.push(`/login?message=${encodeURIComponent(successMsg)}`);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />

      <div style={{ paddingTop: 40 }}>
        <FormCard title="Ganti Password" subtitle="Ubah password akun admin/trainer kamu">
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <PasswordInput
              id="currentPassword"
              label="Password Lama"
              required
              register={register("currentPassword")}
              error={errors.currentPassword?.message}
            />
            <PasswordInput
              id="newPassword"
              label="Password Baru"
              required
              register={register("newPassword")}
              error={errors.newPassword?.message}
              placeholder="Min. 8 karakter"
            />
            <PasswordInput
              id="confirmPassword"
              label="Konfirmasi Password Baru"
              required
              register={register("confirmPassword")}
              error={errors.confirmPassword?.message}
            />

            <SubmitButton label="Ubah Password" loading={isSubmitting} />
          </form>
        </FormCard>
      </div>
    </div>
  );
}
