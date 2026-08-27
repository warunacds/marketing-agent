// Shared between the login action and the middleware. Uses Web Crypto so it
// works in both the Node and Edge runtimes.

export const AUTH_COOKIE = "dashboard_auth"
export const APPROVER_COOKIE = "approver_name"

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}
