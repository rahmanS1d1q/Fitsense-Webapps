"use client";
import React, { useState } from "react";

interface PasswordInputProps {
  id: string;
  label: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  register: Record<string, unknown>;
}

export default function PasswordInput({
  id,
  label,
  placeholder,
  error,
  required,
  register,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);
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
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
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
            padding: "10px 44px 10px 14px",
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
            boxShadow:
              focused && !error ? "0 0 0 3px rgba(59, 130, 246, 0.12)" : "none",
            transition: "all 0.15s ease",
          }}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
            color: "var(--gray-500)",
            display: "flex",
            alignItems: "center",
          }}
        >
          {show ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
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
