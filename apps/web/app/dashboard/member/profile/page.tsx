"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  editProfileSchema,
  EditProfileForm,
} from "../../../../lib/schemas/editProfileSchema";
import {
  changePasswordSchema,
  ChangePasswordForm,
} from "../../../../lib/schemas/changePasswordSchema";
import FormInput from "../../../../components/forms/FormInput";
import FormSelect from "../../../../components/forms/FormSelect";
import PasswordInput from "../../../../components/forms/PasswordInput";
import FormCard from "../../../../components/forms/FormCard";
import SubmitButton from "../../../../components/forms/SubmitButton";
import Navbar from "../../../../components/Navbar";
import { apiPatch, apiGet, getCompanyId, getUserId } from "../../../../lib/api";

export default function MemberProfilePage() {
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [email, setEmail] = useState("");

  const {
    register: regProfile,
    handleSubmit: handleProfile,
    setError: setProfileError,
    reset: resetProfile,
    watch: watchProfile,
    formState: { errors: profileErrors, isSubmitting: profileSubmitting },
  } = useForm<EditProfileForm>({ resolver: zodResolver(editProfileSchema) });

  const dateOfBirth = watchProfile("date_of_birth");
  const getCalculatedAge = (dobString: string | undefined) => {
    if (!dobString) return null;
    const date = new Date(dobString);
    if (isNaN(date.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) {
      age--;
    }
    return age;
  };
  const calculatedAge = getCalculatedAge(dateOfBirth);

  const {
    register: regPwd,
    handleSubmit: handlePwd,
    setError: setPwdError,
    reset: resetPwd,
    formState: { errors: pwdErrors, isSubmitting: pwdSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
  });

  useEffect(() => {
    const companyId = getCompanyId();
    const userId = getUserId();
    if (!companyId || !userId) return;

    apiGet(`/companies/${companyId}/members/${userId}`).then(({ ok, data }) => {
      if (ok && data.member) {
        const m = data.member;
        setEmail(m.email ?? "");
        resetProfile({
          firstName: m.first_name ?? "",
          lastName: m.last_name ?? "",
          gender: m.gender ?? "",
          date_of_birth: m.date_of_birth ? m.date_of_birth.split("T")[0] : "",
          height: m.height ?? undefined,
          weight: m.weight ?? undefined,
          bioCode: m.bio_code ?? "",
        });
      }
    });
  }, [resetProfile]);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 4000);
  };

  const onProfileSubmit = async (data: EditProfileForm) => {
    const companyId = getCompanyId();
    const userId = getUserId();
    const {
      ok,
      status,
      data: res,
    } = await apiPatch(`/companies/${companyId}/members/${userId}`, {
      firstName: data.firstName,
      lastName: data.lastName,
      gender: data.gender || undefined,
      date_of_birth: data.date_of_birth,
      height: data.height || undefined,
      weight: data.weight || undefined,
      bio_code: data.bioCode || undefined,
    });

    if (!ok) {
      if (status === 401 || status === 403)
        showToast("Sesi habis, silakan login ulang", "error");
      else
        setProfileError("root", {
          message: res?.error?.message ?? "Gagal menyimpan",
        });
      return;
    }
    showToast("Profil berhasil diperbarui", "success");
  };

  const onPwdSubmit = async (data: ChangePasswordForm) => {
    const { ok, data: res } = await apiPatch("/auth/change-password", {
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });

    if (!ok) {
      setPwdError("currentPassword", {
        message: res?.error?.message ?? "Password lama salah",
      });
      return;
    }
    showToast("Password berhasil diubah", "success");
    resetPwd();
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />

      {toast && (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            padding: "12px 20px",
            background: toastType === "success" ? "#059669" : "#dc2626",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {toast}
        </div>
      )}

      <FormCard title="Edit Profil" subtitle="Perbarui data profil kamu">
        <form onSubmit={handleProfile(onProfileSubmit)} noValidate>
          <FormInput
            id="email"
            label="Email"
            readOnly
            register={{ value: email, readOnly: true }}
          />
          <FormInput
            id="firstName"
            label="Nama Depan"
            required
            register={regProfile("firstName")}
            error={profileErrors.firstName?.message}
          />
          <FormInput
            id="lastName"
            label="Nama Belakang"
            required
            register={regProfile("lastName")}
            error={profileErrors.lastName?.message}
          />
          <FormInput
            id="date_of_birth"
            label="Tanggal Lahir"
            type="date"
            required
            register={regProfile("date_of_birth")}
            error={profileErrors.date_of_birth?.message}
          />
          {calculatedAge !== null && !profileErrors.date_of_birth && (
            <div style={{ fontSize: 13, color: "#4b5563", marginTop: -12, marginBottom: 16 }}>
              Usia saat ini: <strong>{calculatedAge} tahun</strong> (dihitung otomatis)
            </div>
          )}
          <FormSelect
            id="gender"
            label="Gender"
            register={regProfile("gender")}
            options={[
              { value: "male", label: "Laki-laki" },
              { value: "female", label: "Perempuan" },
            ]}
            placeholder="-- Pilih --"
          />
          <FormInput
            id="height"
            label="Tinggi Badan (cm)"
            type="number"
            register={regProfile("height", { valueAsNumber: true })}
            error={profileErrors.height?.message}
          />
          <FormInput
            id="weight"
            label="Berat Badan (kg)"
            type="number"
            register={regProfile("weight", { valueAsNumber: true })}
            error={profileErrors.weight?.message}
          />
          <FormInput
            id="bioCode"
            label="Kode Anggota"
            register={regProfile("bioCode")}
          />

          {profileErrors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 8 }}>
              {profileErrors.root.message}
            </p>
          )}
          <SubmitButton label="Simpan Profil" loading={profileSubmitting} />
        </form>
      </FormCard>

      <FormCard title="Ganti Password" subtitle="Ubah password akun kamu">
        <form onSubmit={handlePwd(onPwdSubmit)} noValidate>
          <PasswordInput
            id="currentPassword"
            label="Password Lama"
            required
            register={regPwd("currentPassword")}
            error={pwdErrors.currentPassword?.message}
          />
          <PasswordInput
            id="newPassword"
            label="Password Baru"
            required
            register={regPwd("newPassword")}
            error={pwdErrors.newPassword?.message}
            placeholder="Min. 8 karakter"
          />
          <PasswordInput
            id="confirmPassword"
            label="Konfirmasi Password Baru"
            required
            register={regPwd("confirmPassword")}
            error={pwdErrors.confirmPassword?.message}
          />

          <SubmitButton label="Ubah Password" loading={pwdSubmitting} />
        </form>
      </FormCard>
    </div>
  );
}
