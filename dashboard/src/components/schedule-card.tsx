"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveSchedule } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/format"
import type { Schedule } from "@/lib/state"

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

const selectClass =
  "flex h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

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
        <select
          id={`${idPrefix}-day`}
          value={day}
          onChange={(e) => onDay(e.target.value)}
          className={selectClass}
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {d.charAt(0).toUpperCase() + d.slice(1)}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-hour`} className="block text-sm font-medium">
          Time <span className="font-normal text-muted-foreground">(server time)</span>
        </label>
        <select
          id={`${idPrefix}-hour`}
          value={hour}
          onChange={(e) => onHour(Number(e.target.value))}
          className={selectClass}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export function ScheduleCard({ schedule }: { schedule: Schedule }) {
  const [enabled, setEnabled] = useState(schedule.enabled)
  const [day, setDay] = useState(schedule.day)
  const [hour, setHour] = useState(schedule.hour)
  const [instructions, setInstructions] = useState(schedule.instructions)
  const [reportEnabled, setReportEnabled] = useState(schedule.report_enabled)
  const [reportDay, setReportDay] = useState(schedule.report_day)
  const [reportHour, setReportHour] = useState(schedule.report_hour)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveSchedule(schedule.product, {
        enabled,
        day,
        hour,
        instructions,
        report_enabled: reportEnabled,
        report_day: reportDay,
        report_hour: reportHour,
      })
      if (result.ok) {
        toast.success("Schedule saved", {
          description:
            enabled || reportEnabled
              ? "The AI will run on schedule and put its work in Review and Activity."
              : "Automatic runs are off.",
        })
      } else {
        toast.error("Could not save the schedule", { description: result.output.slice(0, 400) })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekly schedule</CardTitle>
        <CardDescription>
          {schedule.last_run
            ? `Last automatic run: ${formatDate(schedule.last_run)}`
            : "No automatic runs yet."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Create content automatically every week
        </label>
        {enabled && (
          <p className="text-xs text-muted-foreground">
            Drafts land in Review for your approval — nothing publishes on its own. If Slack or
            Telegram notifications are set up, you&apos;ll get a ping when drafts are ready.
          </p>
        )}
        <DayHourPicker
          idPrefix={`sched-${schedule.product}`}
          day={day}
          hour={hour}
          onDay={setDay}
          onHour={setHour}
        />
        <div className="space-y-1.5">
          <label
            htmlFor={`sched-instructions-${schedule.product}`}
            className="block text-sm font-medium"
          >
            Standing instructions for every scheduled run (optional)
          </label>
          <Textarea
            id={`sched-instructions-${schedule.product}`}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="e.g. Always include one customer story; never write about pricing"
          />
        </div>

        <Separator />

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
          The AI reviews what went out and what the numbers say, and adds lessons it learns to
          Product info.
          {schedule.report_last_run && ` Last report: ${formatDate(schedule.report_last_run)}.`}
        </p>
        <DayHourPicker
          idPrefix={`sched-report-${schedule.product}`}
          day={reportDay}
          hour={reportHour}
          onDay={setReportDay}
          onHour={setReportHour}
        />

        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save schedule"}
        </Button>
      </CardContent>
    </Card>
  )
}
