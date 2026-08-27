import { StatusPill } from "@/components/ui/status-pill"

type Tone = "good" | "warn" | "bad" | "neutral" | "attention"

const MAP: Record<string, { tone: Tone; label: string }> = {
  PASS: { tone: "good", label: "Checked" },
  FAIL: { tone: "warn", label: "Read before approving" },
  STALE: { tone: "warn", label: "Edited since checked" },
}

/** Fact-check verdict as a calm StatusPill. */
export function FactcheckPill({ verdict }: { verdict?: string }) {
  const m = verdict ? MAP[verdict] : undefined
  if (!m) return <StatusPill tone="neutral">Not checked yet</StatusPill>
  return <StatusPill tone={m.tone}>{m.label}</StatusPill>
}
