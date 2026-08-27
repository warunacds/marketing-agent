import * as React from "react"
import { cn } from "@/lib/utils"

type Tone = "good" | "warn" | "bad" | "neutral" | "attention"

const TONES: Record<Tone, string> = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  attention: "bg-attention-soft text-attention",
  neutral: "bg-surface-sunk text-muted-foreground",
}

/** A small rounded pill with a colored dot + label, tinted by tone. */
function StatusPill({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-[var(--r-pill)] px-2.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className
      )}
      {...props}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  )
}

export { StatusPill }
