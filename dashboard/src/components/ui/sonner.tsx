"use client"

import { useEffect, useState } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  const [theme, setTheme] = useState<ToasterProps["theme"]>("system")

  useEffect(() => {
    const el = document.documentElement
    const update = () => setTheme(el.classList.contains("dark") ? "dark" : "light")
    update()
    const observer = new MutationObserver(update)
    observer.observe(el, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return <Sonner theme={theme} className="toaster group" {...props} />
}

export { Toaster }
