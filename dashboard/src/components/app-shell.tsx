"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CheckIcon, ChevronDownIcon, LogOutIcon, MenuIcon, PlusIcon } from "lucide-react"
import { AddProductDialog } from "@/components/add-product-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { logout } from "@/lib/auth"
import { cn } from "@/lib/utils"

const NAV: { seg: string; label: string }[] = [
  { seg: "", label: "Home" },
  { seg: "review", label: "Review" },
  { seg: "publishing", label: "Publishing" },
  { seg: "knowledge", label: "Knowledge" },
  { seg: "activity", label: "Activity" },
]

export function AppShell({
  product,
  products,
  pendingCount,
  showLogout,
}: {
  product: string
  products: string[]
  pendingCount: number
  showLogout: boolean
}) {
  const pathname = usePathname()
  const base = `/p/${product}`
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  function isActive(seg: string) {
    const href = seg ? `${base}/${seg}` : base
    return seg ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base
  }

  function NavLink({ seg, label }: { seg: string; label: string }) {
    const active = isActive(seg)
    return (
      <Link
        href={seg ? `${base}/${seg}` : base}
        onClick={() => setMobileOpen(false)}
        aria-current={active ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-2 rounded-[var(--r-input)] px-3 py-1.5 text-sm font-medium transition-colors",
          active ? "bg-surface-sunk text-ink" : "text-muted-foreground hover:text-ink"
        )}
      >
        {label}
        {seg === "review" && pendingCount > 0 && (
          <span className="inline-flex min-w-5 items-center justify-center rounded-[var(--r-pill)] bg-attention-soft px-1.5 text-xs font-semibold text-attention tabular-nums">
            {pendingCount}
          </span>
        )}
      </Link>
    )
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        {/* Product switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setSwitcherOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={switcherOpen}
            className="flex items-center gap-2 rounded-[var(--r-input)] px-2 py-1.5 text-left hover:bg-surface-sunk"
          >
            <span className="font-display text-lg font-semibold leading-none text-ink">
              {product}
            </span>
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          </button>
          {switcherOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setSwitcherOpen(false)}
              />
              <div
                role="menu"
                className="absolute left-0 top-full z-50 mt-1 w-60 rounded-[var(--r)] border border-line bg-surface p-1 shadow-[var(--shadow)]"
              >
                <p className="px-3 pb-1 pt-2 text-xs font-medium text-muted-foreground">
                  Your products
                </p>
                {products.map((p) => (
                  <Link
                    key={p}
                    href={`/p/${p}`}
                    role="menuitem"
                    onClick={() => setSwitcherOpen(false)}
                    className="flex items-center justify-between rounded-[var(--r-input)] px-3 py-1.5 text-sm text-ink hover:bg-surface-sunk"
                  >
                    <span className="truncate">{p}</span>
                    {p === product && <CheckIcon className="size-4 text-primary" />}
                  </Link>
                ))}
                <div className="my-1 h-px bg-line" />
                <AddProductDialog
                  trigger={
                    <button
                      type="button"
                      onClick={() => setSwitcherOpen(false)}
                      className="flex w-full items-center gap-2 rounded-[var(--r-input)] px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-sunk"
                    >
                      <PlusIcon className="size-4 text-muted-foreground" />
                      Add product
                    </button>
                  }
                />
              </div>
            </>
          )}
        </div>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.seg || "home"} {...n} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          {showLogout && (
            <form action={logout}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Log out"
                title="Log out"
              >
                <LogOutIcon />
              </Button>
            </form>
          )}
          {/* Mobile nav toggle */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            className="md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            <MenuIcon />
          </Button>
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileOpen && (
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 border-t border-line px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <NavLink key={n.seg || "home"} {...n} />
          ))}
        </nav>
      )}
    </header>
  )
}
