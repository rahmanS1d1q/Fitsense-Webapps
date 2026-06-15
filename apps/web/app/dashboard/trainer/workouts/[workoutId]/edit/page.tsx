"use client";

import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useParams } from "next/navigation";
import {
  createWorkoutSchema,
  CreateWorkoutForm,
} from "../../../../../../lib/schemas/createWorkoutSchema";
import FormInput from "../../../../../../components/forms/FormInput";
import FormCard from "../../../../../../components/forms/FormCard";
import SubmitButton from "../../../../../../components/forms/SubmitButton";
import Navbar from "../../../../../../components/Navbar";
import { apiGet, apiPatch, getCompanyId } from "../../../../../../lib/api";

export default function EditTrainerWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const workoutId = params.workoutId as string;
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkoutForm>({
    resolver: zodResolver(createWorkoutSchema),
  });

  useEffect(() => {
    const companyId = getCompanyId();
    if (!companyId) {
      router.push("/login");
      return;
    }
    apiGet(`/companies/${companyId}/workouts/${workoutId}`).then(
      ({ ok, data }) => {
        if (ok && data.workout) {
          reset({
            name: data.workout.name ?? "",
            intro_activities: data.workout.intro_activities ?? "",
            intro_duration: data.workout.intro_duration ?? undefined,
            asset_id: data.workout.asset_id ?? "",
          });
        } else {
          setNotFound(true);
        }
        setLoading(false);
      },
    );
  }, [workoutId, reset, router]);

  const onSubmit = async (data: CreateWorkoutForm) => {
    const companyId = getCompanyId();
    const { ok, data: res } = await apiPatch(
      `/companies/${companyId}/workouts/${workoutId}`,
      {
        name: data.name,
        intro_activities: data.intro_activities || undefined,
        intro_duration: data.intro_duration || undefined,
        asset_id: data.asset_id || undefined,
      },
    );
    if (!ok) {
      setError("root", { message: res?.error?.message ?? "Gagal menyimpan" });
      return;
    }
    router.push("/dashboard/trainer/workouts");
  };

  if (loading)
    return (
      <>
        <Navbar />
        <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          Memuat...
        </div>
      </>
    );
  if (notFound)
    return (
      <>
        <Navbar />
        <div style={{ padding: 40, textAlign: "center", color: "#dc2626" }}>
          Workout tidak ditemukan
        </div>
      </>
    );

  return (
    <>
      <Navbar />
      <FormCard title="Edit Workout" subtitle="Perbarui program latihan">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormInput
            id="name"
            label="Nama Workout"
            required
            register={register("name")}
            error={errors.name?.message}
          />
          <div style={{ marginBottom: 18 }}>
            <label
              htmlFor="intro_activities"
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "#374151",
              }}
            >
              Deskripsi Kegiatan
            </label>
            <textarea
              id="intro_activities"
              {...register("intro_activities")}
              rows={4}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
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
          />
          {errors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {errors.root.message}
            </p>
          )}
          <SubmitButton label="Simpan Perubahan" loading={isSubmitting} />
        </form>
      </FormCard>
    </>
  );
}
