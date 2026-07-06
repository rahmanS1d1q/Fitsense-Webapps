import React from "react";

interface PaginationProps {
  total: number;
  page: number;
  limit: number;
  pages: number;
  onPageChange: (newPage: number) => void;
  entityLabel?: string;
}

export default function Pagination({
  total,
  page,
  limit,
  pages,
  onPageChange,
  entityLabel = "pengguna",
}: PaginationProps) {
  if (total === 0) return null;

  const startIdx = (page - 1) * limit + 1;
  const endIdx = Math.min(page * limit, total);

  // Generate page numbers
  const getPageNumbers = () => {
    const numbers: (number | string)[] = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) numbers.push(i);
    } else {
      if (page <= 4) {
        numbers.push(1, 2, 3, 4, 5, "...", pages);
      } else if (page >= pages - 3) {
        numbers.push(1, "...", pages - 4, pages - 3, pages - 2, pages - 1, pages);
      } else {
        numbers.push(1, "...", page - 1, page, page + 1, "...", pages);
      }
    }
    return numbers;
  };

  const pageNumbers = getPageNumbers();

  const buttonStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    backgroundColor: active ? "#2563eb" : "#ffffff",
    color: active ? "#ffffff" : "#334155",
    fontWeight: active ? 600 : 500,
    fontSize: "14px",
    cursor: "pointer",
    transition: "all 0.2s",
  });

  const disabledButtonStyle: React.CSSProperties = {
    padding: "8px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    backgroundColor: "#f1f5f9",
    color: "#94a3b8",
    fontWeight: 500,
    fontSize: "14px",
    cursor: "not-allowed",
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "20px",
        flexWrap: "wrap",
        gap: "16px",
      }}
    >
      <div style={{ fontSize: "14px", color: "#64748b" }}>
        Menampilkan {startIdx}-{endIdx} dari {total} {entityLabel}
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        {/* Prev Button */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          style={page === 1 ? disabledButtonStyle : buttonStyle(false)}
        >
          ← Prev
        </button>

        {/* Page Numbers */}
        {pageNumbers.map((num, i) => {
          if (num === "...") {
            return (
              <span
                key={`dots-${i}`}
                style={{ padding: "8px 10px", color: "#64748b", fontSize: "14px" }}
              >
                ...
              </span>
            );
          }
          return (
            <button
              key={`page-${num}`}
              onClick={() => onPageChange(Number(num))}
              style={buttonStyle(page === num)}
            >
              {num}
            </button>
          );
        })}

        {/* Next Button */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === pages}
          style={page === pages ? disabledButtonStyle : buttonStyle(false)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
