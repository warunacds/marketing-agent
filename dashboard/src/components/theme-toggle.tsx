"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

// Which icon shows is pure CSS (dark: variant), so server and client markup
// always match — no hydration mismatch, no flash.
export function ThemeToggle() {
  function toggle() {
    const dark = !document.documentElement.classList.contains("dark")
    document.documentElement.classList.toggle("dark", dark)
    try {
      localStorage.setItem("theme", dark ? "dark" : "light")
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
