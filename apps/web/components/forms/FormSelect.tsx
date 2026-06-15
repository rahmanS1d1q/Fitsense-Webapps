"use client";
import React, { useState } from "react";

interface Option {
  value: string;
  label: string;
}

interface FormSelectProps {
  id: string;
  label: string;
  options: Option[];
  error?: string;
  required?: boolean;
  register: Record<string, unknown>;
  placeholder?: string;
}

export default function FormSelect({
  id,
  label,
  options,
  error,
  required,
  register,
  placeholder,
}: FormSelectProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: 18 }}>
      <label
        htmlFor={id}
        style={{
          display: "block",
          marginBottom: 6,
          fontWeight: 500,
          fontSize: 13,
          color: "var(--gray-700)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--danger-600)", marginLeft: 2 }}>*</span>
        )}
      </label>
      <select
        id={id}
        {...register}
        onFocus={(e) => {
          setFocused(true);
          (
            register as {
              onFocus?: (e: React.FocusEvent<HTMLSelectElement>) => void;
            }
          ).onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          (
            register as {
              onBlur?: (e: React.FocusEvent<HTMLSelectElement>) => void;
            }
          ).onBlur?.(e);
        }}
        style={{
          width: "100%",
          padding: "10px 14px",
          border: error
            ? "1.5px solid var(--danger-500)"
            : focused
              ? "1.5px solid var(--brand-500)"
              : "1.5px solid var(--border-subtle)",
          borderRadius: "var(--radius-md)",
          fontSize: 14,
          boxSizing: "border-box",
          outline: "none",
          background: "var(--bg-card)",
          color: "var(--gray-900)",
          cursor: "pointer",
          boxShadow:
            focused && !error ? "0 0 0 3px rgba(59, 130, 246, 0.12)" : "none",
          transition: "all 0.15s ease",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p
          style={{
            margin: "5px 0 0",
            fontSize: 12,
            color: "var(--danger-600)",
            fontWeight: 500,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
