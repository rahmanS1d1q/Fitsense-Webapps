"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createCompanySchema,
  CreateCompanyForm,
} from "../../../../../lib/schemas/createCompanySchema";
import FormInput from "../../../../../components/forms/FormInput";
import FormSelect from "../../../../../components/forms/FormSelect";
import PasswordInput from "../../../../../components/forms/PasswordInput";
import FormCard from "../../../../../components/forms/FormCard";
import SubmitButton from "../../../../../components/forms/SubmitButton";
import Navbar from "../../../../../components/Navbar";
import { apiPost } from "../../../../../lib/api";

export default function NewCompanyPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateCompanyForm>({
    resolver: zodResolver(createCompanySchema),
  });

  const onSubmit = async (data: CreateCompanyForm) => {
    const {
      ok,
      status,
      data: res,
    } = await apiPost("/admin/companies", {
      name: data.name,
      slug: data.slug,
      address: data.address || undefined,
      phone: data.phone || undefined,
      ownerFirstName: data.ownerFirstName,
      ownerLastName: data.ownerLastName,
      ownerEmail: data.ownerEmail,
      ownerPassword: data.ownerPassword,
      ownerGender: data.ownerGender || undefined,
    });

    if (!ok) {
      if (status === 409 && res?.error?.field === "slug") {
        setError("slug", { message: "Slug sudah digunakan" });
      } else if (status === 409) {
        setError("ownerEmail", { message: "Email sudah terdaftar" });
      } else if (status === 401 || status === 403) {
        router.push("/login");
      } else {
        setError("root", {
          message: res?.error?.message ?? "Terjadi kesalahan, coba lagi",
        });
      }
      return;
    }

    router.push("/dashboard/admin/companies");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <Navbar />
      <FormCard
        title="Buat Company Baru"
        subtitle="Buat company dan akun club owner sekaligus"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 15,
              color: "#059669",
              fontWeight: 600,
            }}
          >
            Data Company
          </h3>
          <FormInput
            id="name"
            label="Nama Company"
            required
            register={register("name")}
            error={errors.name?.message}
            placeholder="Contoh: Gym Sehat"
          />
          <FormInput
            id="slug"
            label="Slug"
            required
            register={register("slug")}
            error={errors.slug?.message}
            placeholder="gym-sehat"
            hint="Huruf kecil, angka, tanda hubung. 3-50 karakter."
          />
          <FormInput
            id="address"
            label="Alamat"
            register={register("address")}
            placeholder="Jl. Contoh No. 1"
          />
          <FormInput
            id="phone"
            label="Telepon"
            register={register("phone")}
            placeholder="08xxxxxxxxxx"
          />

          <hr
            style={{
              margin: "24px 0",
              border: "none",
              borderTop: "1px solid #f1f5f9",
            }}
          />
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: 15,
              color: "#2563eb",
              fontWeight: 600,
            }}
          >
            Data Club Owner
          </h3>
          <FormInput
            id="ownerFirstName"
            label="Nama Depan"
            required
            register={register("ownerFirstName")}
            error={errors.ownerFirstName?.message}
            placeholder="Andi"
          />
          <FormInput
            id="ownerLastName"
            label="Nama Belakang"
            required
            register={register("ownerLastName")}
            error={errors.ownerLastName?.message}
            placeholder="Wijaya"
          />
          <FormInput
            id="ownerEmail"
            label="Email"
            type="email"
            required
            register={register("ownerEmail")}
            error={errors.ownerEmail?.message}
            placeholder="owner@gym.com"
          />
          <PasswordInput
            id="ownerPassword"
            label="Password"
            required
            register={register("ownerPassword")}
            error={errors.ownerPassword?.message}
            placeholder="Min. 8 karakter"
          />
          <FormSelect
            id="ownerGender"
            label="Gender"
            register={register("ownerGender")}
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
          <SubmitButton label="Buat Company" loading={isSubmitting} />
        </form>
      </FormCard>
    </div>
  );
}
