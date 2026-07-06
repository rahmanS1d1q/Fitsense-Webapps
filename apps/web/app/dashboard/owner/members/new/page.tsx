"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  addMemberSchema,
  AddMemberForm,
} from "../../../../../lib/schemas/addMemberSchema";
import FormInput from "../../../../../components/forms/FormInput";
import FormSelect from "../../../../../components/forms/FormSelect";
import PasswordInput from "../../../../../components/forms/PasswordInput";
import FormCard from "../../../../../components/forms/FormCard";
import SubmitButton from "../../../../../components/forms/SubmitButton";
import Navbar from "../../../../../components/Navbar";
import { apiPost, getCompanyId, getRole } from "../../../../../lib/api";

export default function NewMemberPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddMemberForm>({ resolver: zodResolver(addMemberSchema) });

  const dateOfBirth = watch("date_of_birth");
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

  const onSubmit = async (data: AddMemberForm) => {
    const companyId = getCompanyId();
    if (!companyId) {
      router.push("/login");
      return;
    }

    const {
      ok,
      status,
      data: res,
    } = await apiPost(`/companies/${companyId}/members`, {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      password: data.password,
      role: "member",
      date_of_birth: data.date_of_birth,
      gender: data.gender || undefined,
      height: data.height || undefined,
      weight: data.weight || undefined,
      bio_code: data.bioCode || undefined,
    });

    if (!ok) {
      if (status === 409)
        setError("email", { message: "Email sudah terdaftar" });
      else if (status === 401 || status === 403) router.push("/login");
      else
        setError("root", {
          message: res?.error?.message ?? "Terjadi kesalahan, coba lagi",
        });
      return;
    }

    const role = getRole();
    router.push(
      role === "club_owner" ? "/dashboard/trainer" : "/dashboard/trainer",
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />
      <FormCard
        title="Tambah Member"
        subtitle="Daftarkan member baru ke gym. Usia wajib diisi untuk kalkulasi HR zone."
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInput
            id="firstName"
            label="Nama Depan"
            required
            register={register("firstName")}
            error={errors.firstName?.message}
            placeholder="Siti"
          />
          <FormInput
            id="lastName"
            label="Nama Belakang"
            required
            register={register("lastName")}
            error={errors.lastName?.message}
            placeholder="Rahayu"
          />
          <FormInput
            id="email"
            label="Email"
            type="email"
            required
            register={register("email")}
            error={errors.email?.message}
            placeholder="member@email.com"
          />
          <PasswordInput
            id="password"
            label="Password"
            required
            register={register("password")}
            error={errors.password?.message}
            placeholder="Min. 8 karakter"
          />
          <FormInput
            id="date_of_birth"
            label="Tanggal Lahir"
            type="date"
            required
            register={register("date_of_birth")}
            error={errors.date_of_birth?.message}
          />
          {calculatedAge !== null && !errors.date_of_birth && (
            <div style={{ fontSize: 13, color: "#4b5563", marginTop: -12, marginBottom: 16 }}>
              Usia saat ini: <strong>{calculatedAge} tahun</strong> (dihitung otomatis)
            </div>
          )}
          <FormSelect
            id="gender"
            label="Gender"
            register={register("gender")}
            options={[
              { value: "male", label: "Laki-laki" },
              { value: "female", label: "Perempuan" },
            ]}
            placeholder="-- Pilih (opsional) --"
          />
          <FormInput
            id="height"
            label="Tinggi Badan (cm)"
            type="number"
            register={register("height", { valueAsNumber: true })}
            error={errors.height?.message}
            placeholder="170"
          />
          <FormInput
            id="weight"
            label="Berat Badan (kg)"
            type="number"
            register={register("weight", { valueAsNumber: true })}
            error={errors.weight?.message}
            placeholder="65"
          />
          <FormInput
            id="bioCode"
            label="Kode Anggota"
            register={register("bioCode")}
            placeholder="Nomor kartu gym (opsional)"
          />

          {errors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {errors.root.message}
            </p>
          )}
          <SubmitButton label="Tambah Member" loading={isSubmitting} />
        </form>
      </FormCard>
    </div>
  );
}
