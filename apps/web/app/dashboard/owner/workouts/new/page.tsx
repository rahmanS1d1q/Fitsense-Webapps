"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import {
  createWorkoutSchema,
  CreateWorkoutForm,
} from "../../../../../lib/schemas/createWorkoutSchema";
import FormInput from "../../../../../components/forms/FormInput";
import FormCard from "../../../../../components/forms/FormCard";
import SubmitButton from "../../../../../components/forms/SubmitButton";
import Navbar from "../../../../../components/Navbar";
import { apiPost, getCompanyId } from "../../../../../lib/api";

export default function NewWorkoutPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkoutForm>({
    resolver: zodResolver(createWorkoutSchema),
  });

  const onSubmit = async (data: CreateWorkoutForm) => {
    const companyId = getCompanyId();
    if (!companyId) {
      router.push("/login");
      return;
    }

    const { ok, data: res } = await apiPost(
      `/companies/${companyId}/workouts`,
      {
        name: data.name,
        intro_activities: data.intro_activities || undefined,
        intro_duration: data.intro_duration || undefined,
        asset_id: data.asset_id || undefined,
      },
    );

    if (!ok) {
      setError("root", {
        message: res?.error?.message ?? "Gagal membuat workout",
      });
      return;
    }
    router.push("/dashboard/owner/workouts");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <FormCard
        title="Buat Workout Baru"
        subtitle="Tambah program latihan untuk member"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInput
            id="name"
            label="Nama Workout"
            required
            register={register("name")}
            error={errors.name?.message}
            placeholder="Contoh: HIIT Cardio 30 Menit"
          />
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="intro_activities"
              style={{
                display: "block",
                marginBottom: 5,
                fontWeight: 500,
                fontSize: 14,
                color: "#374151",
              }}
            >
              Deskripsi Kegiatan
            </label>
            <textarea
              id="intro_activities"
              {...register("intro_activities")}
              placeholder="Deskripsi kegiatan latihan"
              rows={4}
              style={{
                width: "100%",
                padding: "9px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>
          <FormInput
            id="intro_duration"
            label="Durasi (menit)"
            type="number"
            register={register("intro_duration", { valueAsNumber: true })}
            error={errors.intro_duration?.message}
            placeholder="30"
          />
          {errors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {errors.root.message}
            </p>
          )}
          <SubmitButton label="Buat Workout" loading={isSubmitting} />
        </form>
      </FormCard>
    </div>
  );
}
