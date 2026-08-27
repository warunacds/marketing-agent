"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

// Which icon shows is pure CSS (dark: variant, keyed on data-theme + the OS
// preference), so server and client markup always match — no hydration
// mismatch, no flash.
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement
    const attr = root.getAttribute("data-theme")
    const isDark = attr
      ? attr === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches
    const next = isDark ? "light" : "dark"
    root.setAttribute("data-theme", next)
    try {
      localStorage.setItem("theme", next)
    } catch {
      // storage unavailable — the theme still switches for this page
    }
  }
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Switch between light and dark mode"
      onClick={toggle}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
