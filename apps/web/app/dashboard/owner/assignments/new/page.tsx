"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Navbar from "../../../../../components/Navbar";
import FormCard from "../../../../../components/forms/FormCard";
import FormInput from "../../../../../components/forms/FormInput";
import SubmitButton from "../../../../../components/forms/SubmitButton";
import {
  createAssignmentSchema,
  CreateAssignmentForm,
} from "../../../../../lib/schemas/createAssignmentSchema";
import { apiGet, apiPost, getCompanyId } from "../../../../../lib/api";

interface Member {
  id: string;
  first_name: string;
  last_name: string;
}
interface Workout {
  id: string;
  name: string;
}

export default function NewOwnerAssignmentPage() {
  const router = useRouter();
  const companyId = getCompanyId();
  const [members, setMembers] = useState<Member[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateAssignmentForm>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: { assigned_date: today },
  });

  useEffect(() => {
    if (!companyId) return;
    Promise.all([
      apiGet(`/companies/${companyId}/members`),
      apiGet(`/companies/${companyId}/workouts`),
    ]).then(([mRes, wRes]) => {
      if (mRes.ok)
        setMembers(
          (mRes.data.members ?? []).filter(
            (m: { role: string }) => m.role === "member",
          ),
        );
      if (wRes.ok) setWorkouts(wRes.data.workouts ?? []);
    });
  }, [companyId]);

  const onSubmit = async (data: CreateAssignmentForm) => {
    if (!companyId) {
      router.push("/login");
      return;
    }
    const { ok, data: res } = await apiPost(
      `/companies/${companyId}/assignments`,
      data,
    );
    if (!ok) {
      setError("root", {
        message: res?.error?.message ?? "Gagal membuat assignment",
      });
      return;
    }
    router.push("/dashboard/owner/assignments");
  };

  return (
    <>
      <Navbar />
      <FormCard
        title="Assign Workout"
        subtitle="Assign workout ke member untuk hari latihan"
      >
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "#374151",
              }}
            >
              Member <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              {...register("member_id")}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: `1px solid ${errors.member_id ? "#dc2626" : "#e5e7eb"}`,
                borderRadius: 8,
                fontSize: 14,
                background: "#fff",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Pilih Member —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </option>
              ))}
            </select>
            {errors.member_id && (
              <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                {errors.member_id.message}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 18 }}>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 500,
                fontSize: 13,
                color: "#374151",
              }}
            >
              Workout <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <select
              {...register("workout_id")}
              style={{
                width: "100%",
                padding: "10px 14px",
                border: `1px solid ${errors.workout_id ? "#dc2626" : "#e5e7eb"}`,
                borderRadius: 8,
                fontSize: 14,
                background: "#fff",
                boxSizing: "border-box",
              }}
            >
              <option value="">— Pilih Workout —</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            {errors.workout_id && (
              <p style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>
                {errors.workout_id.message}
              </p>
            )}
          </div>

          <FormInput
            id="assigned_date"
            label="Tanggal"
            type="date"
            required
            register={register("assigned_date")}
            error={errors.assigned_date?.message}
          />

          <div style={{ marginBottom: 18 }}>
            <label
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
              {...register("notes")}
              placeholder="Catatan tambahan (opsional)"
              rows={3}
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

          {errors.root && (
            <p style={{ color: "#dc2626", fontSize: 14, marginBottom: 12 }}>
              {errors.root.message}
            </p>
          )}
          <SubmitButton label="Assign Workout" loading={isSubmitting} />
        </form>
      </FormCard>
    </>
  );
}
