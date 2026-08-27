import Link from "next/link"
import { AutoRefresh } from "@/components/auto-refresh"
import { Markdown } from "@/components/markdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { describeJob, formatDate, JOB_STATUS } from "@/lib/format"
import { getJobs, getRunCosts, getRunFile, getRuns } from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function ActivityPage() {
  const [jobs, runs] = await Promise.all([getJobs(), getRuns()])
  const reportRuns = runs.filter((r) => r.files.includes("report.md"))
  const [costs, reports] = await Promise.all([
    Promise.all(runs.map((r) => getRunCosts(r.date, r.product))),
    Promise.all(reportRuns.map((r) => getRunFile(r.date, r.product, "report.md"))),
  ])

  return (
    <div className="space-y-8">
      <AutoRefresh active={jobs.some((j) => j.status === "running")} />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
        <p className="text-sm text-muted-foreground">
          Everything the AI has been asked to do, newest first. This page updates on its own while
          something is running.
        </p>
      </div>
      {jobs.length === 0 && (
        <p className="text-sm text-muted-foreground/70">
          Nothing yet. Go to the Review page and press &quot;Create this week&apos;s content&quot;.
        </p>
      )}
      <div className="space-y-3">
        {jobs.map((job) => {
          const { title, when } = describeJob(job.id)
          const status = JOB_STATUS[job.status] ?? { label: job.status, variant: "secondary" as const }
          return (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{title}</CardTitle>
                    <CardDescription>{when}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/runs/${job.id}`}>View details</Link>
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )
        })}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Weekly reports</h2>
        <p className="text-sm text-muted-foreground/70">
          The AI reviews what went out and what the numbers say. Lessons it learns are added to
          Product info automatically.
        </p>
        {reportRuns.length === 0 && (
          <p className="text-sm text-muted-foreground/70">No reports yet.</p>
        )}
        <div className="space-y-2">
          {reportRuns.map((run, i) => (
            <details key={`${run.date}-${run.product}`} className="rounded-lg border">
              <summary className="cursor-pointer px-4 py-3 text-sm">
                {formatDate(run.date)} — {run.product}
              </summary>
              <div className="border-t p-6">
                <Markdown>{reports[i]}</Markdown>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Cost of each run</h2>
        <p className="text-sm text-muted-foreground/70">
          What the AI spent creating each batch of content. Click a row for the breakdown.
        </p>
        {runs.length === 0 && <p className="text-sm text-muted-foreground/70">No runs yet.</p>}
        <div className="space-y-2">
          {runs.map((run, i) => {
            const detail = costs[i]
            return (
              <details key={`${run.date}-${run.product}`} className="rounded-lg border">
                <summary className="cursor-pointer px-4 py-3 text-sm">
                  {formatDate(run.date)} — {run.product} —{" "}
                  <span className="tabular-nums">${run.total_cost_usd.toFixed(2)}</span>
                </summary>
                <div className="border-t p-4">
                  {!detail || detail.steps.length === 0 ? (
                    <p className="text-sm text-muted-foreground/70">
                      No cost details recorded for this run.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Model</TableHead>
                          <TableHead className="text-right">Tokens in/out</TableHead>
                          <TableHead className="text-right">Cost</TableHead>
                          <TableHead className="text-right">Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.steps.map((step, j) => (
                          <TableRow key={j}>
                            <TableCell>{step.agent}</TableCell>
                            <TableCell className="font-mono text-xs">{step.model}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {step.input_tokens ?? "–"} / {step.output_tokens ?? "–"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {step.cost_usd != null ? `$${step.cost_usd.toFixed(3)}` : "–"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {step.duration_s}s
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </section>
    </div>
  )
}
