import * as React from "react"
import { cn } from "@/lib/utils"

/** Calm, centered placeholder that teaches the next step. */
function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-[var(--r)] border border-dashed border-line px-6 py-10 text-center",
        className
      )}
    >
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
