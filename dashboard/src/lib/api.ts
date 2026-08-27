// Server-only helper for the FastAPI backend (marketing_agent/api.py).
// The API key must never reach the browser: only import this module from
// server components and server actions.

const BASE = process.env.API_URL ?? "http://127.0.0.1:8000"

export class ApiError extends Error {
  readonly status: number
  /** Machine-readable conflict code (e.g. revising, factcheck_fail) when the API sends one. */
  readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("X-API-Key", process.env.MARKETING_API_KEY ?? "")
  if (init?.body != null) headers.set("Content-Type", "application/json")

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" })
  } catch {
    throw new ApiError(`Could not reach the backend at ${BASE} — is it running?`, 0)
  }

  if (!res.ok) {
    // detail is usually a string; conflict endpoints send {code, message}.
    let message = `${res.status} ${res.statusText}`
    let code: string | undefined
    try {
      const data: unknown = await res.json()
      if (data && typeof data === "object" && "detail" in data) {
        const detail = (data as { detail: unknown }).detail
        if (typeof detail === "string") {
          message = detail
        } else if (detail && typeof detail === "object") {
          const d = detail as { message?: unknown; code?: unknown }
          if (typeof d.message === "string") message = d.message
          if (typeof d.code === "string") code = d.code
        }
      }
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new ApiError(message, res.status, code)
  }
  return (await res.json()) as T
}
