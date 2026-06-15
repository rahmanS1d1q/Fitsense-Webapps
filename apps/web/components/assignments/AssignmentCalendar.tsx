"use client";
import React, { useState, useMemo } from "react";
import type { AssignmentStatus } from "./AssignmentStatusBadge";

export interface CalendarAssignment {
  id: string;
  assigned_date: string; // YYYY-MM-DD
  status: AssignmentStatus;
  workout_name: string;
}

interface Props {
  assignments: CalendarAssignment[];
  onDateSelect?: (date: string, items: CalendarAssignment[]) => void;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay(); // 0=Sun
}

export default function AssignmentCalendar({
  assignments,
  onDateSelect,
}: Props) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a map: date string → assignments[]
  const dateMap = useMemo(() => {
    const m = new Map<string, CalendarAssignment[]>();
    assignments.forEach((a) => {
      const existing = m.get(a.assigned_date) ?? [];
      m.set(a.assigned_date, [...existing, a]);
    });
    return m;
  }, [assignments]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }

  function dotColor(items: CalendarAssignment[]): string {
    const hasPending = items.some((a) => a.status === "pending");
    const allDone = items.every((a) => a.status === "completed");
    if (hasPending) return "#f59e0b";
    if (allDone) return "#22c55e";
    return "#94a3b8";
  }

  const monthNames = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

  const cells: React.ReactNode[] = [];
  // Empty cells for first week
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e-${i}`} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const items = dateMap.get(dateStr);
    const isToday = dateStr === isoDate(today);
    const isSelected = dateStr === selectedDate;

    cells.push(
      <button
        key={dateStr}
        onClick={() => {
          setSelectedDate(dateStr);
          onDateSelect?.(dateStr, items ?? []);
        }}
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1",
          border: isSelected ? "2px solid #3b82f6" : "1px solid transparent",
          borderRadius: 8,
          background: isSelected ? "#eff6ff" : isToday ? "#f0fdf4" : "#fff",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          fontSize: 13,
          fontWeight: isToday ? 700 : 400,
          color: isToday ? "#16a34a" : "#374151",
          transition: "background 0.15s",
        }}
      >
        {d}
        {items && (
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: dotColor(items),
            }}
          />
        )}
      </button>,
    );
  }

  const selectedItems = selectedDate ? (dateMap.get(selectedDate) ?? []) : [];

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: "1px solid #f1f5f9",
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "#64748b",
            padding: "0 8px",
          }}
        >
          ‹
        </button>
        <span style={{ fontWeight: 600, fontSize: 15, color: "#111827" }}>
          {monthNames[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 18,
            color: "#64748b",
            padding: "0 8px",
          }}
        >
          ›
        </button>
      </div>

      {/* Day names */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          padding: "8px 12px 0",
          gap: 4,
        }}
      >
        {dayNames.map((d) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "#94a3b8",
              padding: "4px 0",
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          padding: "4px 12px 12px",
          gap: 4,
        }}
      >
        {cells}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          padding: "8px 16px 12px",
          fontSize: 12,
          color: "#64748b",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f59e0b",
              marginRight: 4,
            }}
          />
          Ada pending
        </span>
        <span>
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#22c55e",
              marginRight: 4,
            }}
          />
          Semua selesai
        </span>
      </div>

      {/* Selected date details */}
      {selectedDate && selectedItems.length > 0 && (
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 16px" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "#374151",
              marginBottom: 8,
            }}
          >
            {new Date(selectedDate).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          {selectedItems.map((item) => (
            <div
              key={item.id}
              style={{
                fontSize: 13,
                color: "#64748b",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background:
                    item.status === "pending"
                      ? "#f59e0b"
                      : item.status === "completed"
                        ? "#22c55e"
                        : "#94a3b8",
                  flexShrink: 0,
                }}
              />
              {item.workout_name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
