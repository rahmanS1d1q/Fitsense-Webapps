"use client";
import React from "react";

export default function DeviceOwnerBadge({
  ownerType,
}: {
  ownerType: "company" | "individual";
}) {
  return ownerType === "company" ? (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: "#f3e8ff",
        color: "#7e22ce",
      }}
    >
      Company
    </span>
  ) : (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: "#f1f5f9",
        color: "#64748b",
      }}
    >
      Pribadi
    </span>
  );
}
