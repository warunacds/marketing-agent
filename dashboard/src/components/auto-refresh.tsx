"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/** Re-fetches the current page's server data on an interval while `active`. */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs, router])
  return null
}
