const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function getAuthHeaders(): HeadersInit {
  const jwt =
    typeof window !== "undefined" ? sessionStorage.getItem("jwt") : null;
  return jwt
    ? { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

export function getCompanyId(): string {
  return typeof window !== "undefined"
    ? (sessionStorage.getItem("companyId") ?? "")
    : "";
}

export function getRole(): string {
  return typeof window !== "undefined"
    ? (sessionStorage.getItem("role") ?? "")
    : "";
}

export function getUserId(): string {
  return typeof window !== "undefined"
    ? (sessionStorage.getItem("userId") ?? "")
    : "";
}

export async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function apiPatch(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function apiGet(path: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function apiDelete(path: string, body?: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}
