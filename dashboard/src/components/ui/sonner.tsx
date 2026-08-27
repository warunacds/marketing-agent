"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("system")

  useEffect(() => {
    const el = document.documentElement
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const update = () => {
      const attr = el.getAttribute("data-theme")
      const dark = attr ? attr === "dark" : media.matches
      setTheme(dark ? "dark" : "light")
    }
    update()
    const observer = new MutationObserver(update)
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] })
    media.addEventListener("change", update)
    return () => {
      observer.disconnect()
      media.removeEventListener("change", update)
    }
  }, [])

  return <Sonner theme={theme} className="toaster group" {...props} />
}

export { Toaster }
