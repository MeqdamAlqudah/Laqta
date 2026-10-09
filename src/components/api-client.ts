"use client";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Fetch wrapper for staff UI calls: JSON in/out, error contract -> exception. */
export async function api<T = unknown>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: init.body ? { "content-type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const fieldMsg = data.fields ? Object.values(data.fields as Record<string, string>).join(", ") : "";
    throw new ApiClientError(res.status, data.error ?? "ERROR", data.message ?? (fieldMsg || data.error || "Request failed"), data.fields);
  }
  return data as T;
}
