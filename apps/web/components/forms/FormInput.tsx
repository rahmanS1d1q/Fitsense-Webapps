"use client";
import React, { useState } from "react";

interface FormInputProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  readOnly?: boolean;
  register: Record<string, unknown>;
}

export default function FormInput({
  id,
  label,
  type = "text",
  placeholder,
  hint,
  error,
  required,
  readOnly,
  register,
}: FormInputProps) {
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
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        readOnly={readOnly}
        {...register}
        onFocus={(e) => {
          setFocused(true);
          (
            register as {
              onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
            }
          ).onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          (
            register as {
              onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
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
          background: readOnly ? "var(--gray-50)" : "var(--bg-card)",
          color: "var(--gray-900)",
          boxShadow:
            focused && !error ? "0 0 0 3px rgba(59, 130, 246, 0.12)" : "none",
          transition: "all 0.15s ease",
        }}
      />
      {hint && !error && (
        <p
          style={{ margin: "5px 0 0", fontSize: 12, color: "var(--gray-500)" }}
        >
          {hint}
        </p>
      )}
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
