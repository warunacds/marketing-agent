"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { generateChannel, saveSchedule } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import type { Cadence, Schedule, ScheduleTarget } from "@/lib/state"

const TARGETS: { target: ScheduleTarget; label: string }[] = [
  { target: "blog", label: "Blog post" },
  { target: "x", label: "X (Twitter)" },
  { target: "linkedin", label: "LinkedIn" },
  { target: "reddit", label: "Reddit" },
  { target: "newsletter", label: "Newsletter" },
]

// Reads naturally after "Creating your …" (avoids "Blog post post").
const MAKE_NOW_NAME: Record<string, string> = {
  blog: "blog post",
  x: "X post",
  linkedin: "LinkedIn post",
  reddit: "Reddit post",
  newsletter: "newsletter",
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const clamp = (n: number, lo: number, hi: number) =>
  Number.isNaN(n) ? lo : Math.min(hi, Math.max(lo, n))

interface RowState {
  enabled: boolean
  cadence: Cadence
  everyNDays: number
  day: string
  hour: number
  autoPublish: boolean
  instructions: string
  lastRun?: string | null
}

function rowFrom(schedule: Schedule, target: ScheduleTarget): RowState {
  const e = schedule.entries.find((x) => x.target === target)
  return {
    enabled: e?.enabled ?? false,
    cadence: e?.cadence ?? "weekly",
    everyNDays: e?.every_n_days ?? 3,
    day: e?.day ?? "monday",
    hour: e?.hour ?? 9,
    autoPublish: e?.auto_publish ?? false,
    instructions: e?.instructions ?? "",
    lastRun: e?.last_run ?? null,
  }
}

function DayHourPicker({
  idPrefix,
  day,
  hour,
  onDay,
  onHour,
}: {
  idPrefix: string
  day: string
  hour: number
  onDay: (d: string) => void
  onHour: (h: number) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-day`} className="block text-sm font-medium">
          Day
        </label>
        <Select
          id={`${idPrefix}-day`}
          value={day}
          onChange={(e) => onDay(e.target.value)}
          className="w-auto"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {cap(d)}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-hour`} className="block text-sm font-medium">
          Time <span className="font-normal text-muted-foreground">(server time)</span>
        </label>
        <Select
          id={`${idPrefix}-hour`}
          value={hour}
          onChange={(e) => onHour(Number(e.target.value))}
          className="w-auto"
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

export function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const router = useRouter()
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(TARGETS.map((t) => [t.target, rowFrom(schedule, t.target)]))
  )
  const [reportEnabled, setReportEnabled] = useState(schedule.report_enabled)
  const [reportDay, setReportDay] = useState(schedule.report_day)
  const [reportHour, setReportHour] = useState(schedule.report_hour)
  const [pending, startTransition] = useTransition()
  const [makingNow, setMakingNow] = useState<string | null>(null)

  function update(target: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [target]: { ...prev[target], ...patch } }))
  }

  function save() {
    startTransition(async () => {
      // Send an entry for every channel so toggling one off keeps its config.
      const entries = TARGETS.map(({ target }) => {
        const r = rows[target]
        return {
          target,
          enabled: r.enabled,
          cadence: r.cadence,
          every_n_days: r.everyNDays,
          day: r.day,
          hour: r.hour,
          auto_publish: r.autoPublish,
          instructions: r.instructions.trim(),
        }
      })
      const result = await saveSchedule(schedule.product, {
        entries,
        report_enabled: reportEnabled,
        report_day: reportDay,
        report_hour: reportHour,
      })
      if (result.ok) {
        const anyOn = entries.some((e) => e.enabled) || reportEnabled
        toast.success("Schedule saved", {
          description: anyOn
            ? "The AI will run on schedule and put its work in Review."
            : "Automatic runs are off.",
        })
        router.refresh()
      } else {
        toast.error("Could not save the schedule", { description: result.output.slice(0, 400) })
      }
    })
  }

  function makeNow(target: string) {
    setMakingNow(target)
    startTransition(async () => {
      const result = await generateChannel(
        schedule.product,
        target,
        rows[target].instructions.trim() || undefined
      )
      setMakingNow(null)
      if (result.ok) {
        toast.success(`Creating your ${MAKE_NOW_NAME[target] ?? "post"}`, {
          description: "It'll appear in Review when it's ready.",
          action: {
            label: "View Activity",
            onClick: () => router.push(`/p/${schedule.product}/activity`),
          },
        })
        router.refresh()
      } else {
        toast.error("Could not start", { description: result.output.slice(0, 400) })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Content by channel</CardTitle>
        <CardDescription>
          Give each channel its own rhythm — daily, every few days, or weekly. Everything still
          waits for your approval unless you turn on auto-publish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {TARGETS.map(({ target, label }) => {
          const r = rows[target]
          return (
            <div key={target} className="space-y-3 rounded-[var(--r-input)] border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={r.enabled}
                    onChange={(e) => update(target, { enabled: e.target.checked })}
                  />
                  {label}
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  onClick={() => makeNow(target)}
                >
                  {makingNow === target ? "Starting…" : "Make one now"}
                </Button>
              </div>

              {r.enabled && (
                <div className="space-y-3 border-t border-line pt-3">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                      <label htmlFor={`${target}-cadence`} className="block text-sm font-medium">
                        How often
                      </label>
                      <Select
                        id={`${target}-cadence`}
                        value={r.cadence}
                        onChange={(e) => update(target, { cadence: e.target.value as Cadence })}
                        className="w-auto"
                      >
                        <option value="daily">Every day</option>
                        <option value="every_n_days">Every few days</option>
                        <option value="weekly">Weekly</option>
                      </Select>
                    </div>

                    {r.cadence === "every_n_days" && (
                      <div className="space-y-1.5">
                        <label htmlFor={`${target}-n`} className="block text-sm font-medium">
                          Every
                        </label>
                        <div className="flex items-center gap-2">
                          <Input
                            id={`${target}-n`}
                            type="number"
                            min={1}
                            max={60}
                            value={r.everyNDays}
                            onChange={(e) =>
                              update(target, { everyNDays: clamp(Number(e.target.value), 1, 60) })
                            }
                            className="w-20"
                          />
                          <span className="text-sm text-muted-foreground">days</span>
                        </div>
                      </div>
                    )}

                    {r.cadence === "weekly" && (
                      <div className="space-y-1.5">
                        <label htmlFor={`${target}-day`} className="block text-sm font-medium">
                          On
                        </label>
                        <Select
                          id={`${target}-day`}
                          value={r.day}
                          onChange={(e) => update(target, { day: e.target.value })}
                          className="w-auto"
                        >
                          {DAYS.map((d) => (
                            <option key={d} value={d}>
                              {cap(d)}
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor={`${target}-hour`} className="block text-sm font-medium">
                        Time <span className="font-normal text-muted-foreground">(server time)</span>
                      </label>
                      <Select
                        id={`${target}-hour`}
                        value={r.hour}
                        onChange={(e) => update(target, { hour: Number(e.target.value) })}
                        className="w-auto"
                      >
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>
                            {h}:00
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={r.autoPublish}
                        onChange={(e) => update(target, { autoPublish: e.target.checked })}
                      />
                      Auto-publish
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Posts on its own once it passes the fact-check. Leave off to approve each one
                      first.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor={`${target}-instr`} className="block text-sm font-medium">
                      Standing instructions{" "}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <Textarea
                      id={`${target}-instr`}
                      value={r.instructions}
                      onChange={(e) => update(target, { instructions: e.target.value })}
                      placeholder="e.g. Keep it punchy; always link to the tool"
                      className="min-h-16"
                    />
                  </div>

                  {r.lastRun && (
                    <p className="text-xs text-muted-foreground">Last run: {formatDate(r.lastRun)}</p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <Separator />

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={reportEnabled}
              onChange={(e) => setReportEnabled(e.target.checked)}
            />
            Weekly performance report
          </label>
          <p className="text-xs text-muted-foreground">
            The AI reviews what went out and what the numbers say, and adds lessons it learns to what
            it knows about your product.
            {schedule.report_last_run && ` Last report: ${formatDate(schedule.report_last_run)}.`}
          </p>
          <DayHourPicker
            idPrefix="report"
            day={reportDay}
            hour={reportHour}
            onDay={setReportDay}
            onHour={setReportHour}
          />
        </div>

        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
      </CardContent>
    </Card>
  )
}
