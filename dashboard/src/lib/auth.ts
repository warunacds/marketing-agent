"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { APPROVER_COOKIE, AUTH_COOKIE, sha256Hex } from "./password"

export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "")
  const name = String(formData.get("name") ?? "").trim().slice(0, 80)
  const expected = process.env.DASHBOARD_PASSWORD

  if (expected && password === expected) {
    const store = await cookies()
    store.set(AUTH_COOKIE, await sha256Hex(expected), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    if (name) {
      store.set(APPROVER_COOKIE, name, {
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // remembered long-term
      })
    } else {
      store.delete(APPROVER_COOKIE)
    }
    redirect("/")
  }
  redirect("/login?error=1")
}

export async function logout(): Promise<void> {
  const store = await cookies()
  store.delete(AUTH_COOKIE)
  redirect("/login")
}
