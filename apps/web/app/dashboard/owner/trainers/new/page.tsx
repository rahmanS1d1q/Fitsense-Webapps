"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  addTrainerSchema,
  AddTrainerForm,
} from "../../../../../lib/schemas/addTrainerSchema";
import FormInput from "../../../../../components/forms/FormInput";
import FormSelect from "../../../../../components/forms/FormSelect";
import PasswordInput from "../../../../../components/forms/PasswordInput";
import FormCard from "../../../../../components/forms/FormCard";
import SubmitButton from "../../../../../components/forms/SubmitButton";
import Navbar from "../../../../../components/Navbar";
import { apiPost, getCompanyId } from "../../../../../lib/api";

export default function NewTrainerPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddTrainerForm>({
    resolver: zodResolver(addTrainerSchema),
    defaultValues: { role: "trainer" },
  });

  const onSubmit = async (data: AddTrainerForm) => {
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
      role: data.role,
      gender: data.gender || undefined,
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

    router.push("/dashboard/trainer");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />
      <FormCard
        title="Tambah Trainer / Staff"
        subtitle="Buat akun trainer atau club owner baru"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInput
            id="firstName"
            label="Nama Depan"
            required
            register={register("firstName")}
            error={errors.firstName?.message}
            placeholder="Budi"
          />
          <FormInput
            id="lastName"
            label="Nama Belakang"
            required
            register={register("lastName")}
            error={errors.lastName?.message}
            placeholder="Santoso"
          />
          <FormInput
            id="email"
            label="Email"
            type="email"
            required
            register={register("email")}
            error={errors.email?.message}
            placeholder="trainer@gym.com"
          />
          <PasswordInput
            id="password"
            label="Password"
            required
            register={register("password")}
            error={errors.password?.message}
            placeholder="Min. 8 karakter"
          />
          <FormSelect
            id="role"
            label="Role"
            required
            register={register("role")}
            error={errors.role?.message}
            options={[
              { value: "trainer", label: "Trainer" },
              { value: "club_owner", label: "Club Owner" },
            ]}
          />
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

          {errors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {errors.root.message}
            </p>
          )}
          <SubmitButton label="Tambah Trainer" loading={isSubmitting} />
        </form>
      </FormCard>
    </div>
  );
}
