import Link from "next/link"
import { notFound } from "next/navigation"
import { AutoRefresh } from "@/components/auto-refresh"
import { Markdown } from "@/components/markdown"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { describeJob, formatDate, JOB_STATUS } from "@/lib/format"
import { getJobs, getProducts, getRunCosts, getRunFile, getRuns, type Job } from "@/lib/state"

export const dynamic = "force-dynamic"

function JobCard({ job, product }: { job: Job; product: string }) {
  const { title, when } = describeJob(job.id)
  const status = JOB_STATUS[job.status] ?? { label: job.status, variant: "secondary" as const }
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{when}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={status.variant}>{status.label}</Badge>
            <Button asChild variant="outline" size="sm">
              <Link href={`/p/${product}/activity/${job.id}`}>View details</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ product: string }>
}) {
  const { product } = await params
  const products = await getProducts()
  if (!products.includes(product)) notFound()

  const [jobs, runs] = await Promise.all([getJobs(product), getRuns(product)])
  const running = jobs.filter((j) => j.status === "running")
  const pastJobs = jobs.filter((j) => j.status !== "running")
  const reportRuns = runs.filter((r) => r.files.includes("report.md"))
  const [costs, reports] = await Promise.all([
    Promise.all(runs.map((r) => getRunCosts(r.date, r.product))),
    Promise.all(reportRuns.map((r) => getRunFile(r.date, r.product, "report.md"))),
  ])

  return (
    <div className="space-y-8">
      <AutoRefresh active={running.length > 0} />
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Activity</h1>
        <p className="text-sm text-muted-foreground">
          A log of what the AI has done — past runs, reports, and what it cost.
        </p>
      </div>

      {running.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-base font-semibold text-ink">Running now</h2>
          <p className="text-sm text-muted-foreground">This updates on its own while it works.</p>
          <div className="space-y-2">
            {running.map((job) => (
              <JobCard key={job.id} job={job} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-ink">Recent runs</h2>
        {pastJobs.length === 0 ? (
          <EmptyState
            title="Nothing has run yet."
            description="When the AI creates content or a report, it shows up here."
          />
        ) : (
          <div className="space-y-2">
            {pastJobs.map((job) => (
              <JobCard key={job.id} job={job} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-ink">Weekly reports</h2>
        <p className="text-sm text-muted-foreground">
          The AI reviews what went out and what the numbers say. Lessons it learns are added to what
          it knows automatically.
        </p>
        {reportRuns.length === 0 ? (
          <EmptyState
            title="No reports yet."
            description="Turn on the weekly report in Publishing to get these."
          />
        ) : (
          <div className="space-y-2">
            {reportRuns.map((run, i) => (
              <details
                key={`${run.date}-${run.product}`}
                className="rounded-[var(--r)] border border-line bg-surface"
              >
                <summary className="cursor-pointer px-4 py-3 text-sm">
                  {formatDate(run.date)} — {run.product}
                </summary>
                <div className="border-t border-line p-6">
                  <Markdown>{reports[i]}</Markdown>
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-semibold text-ink">Cost</h2>
        <p className="text-sm text-muted-foreground">
          What the AI spent on each run. Open a row for the step-by-step breakdown.
        </p>
        {runs.length === 0 ? (
          <EmptyState
            title="No costs to show yet."
            description="Each run's cost appears here once the AI has done some work."
          />
        ) : (
          <div className="space-y-2">
            {runs.map((run, i) => {
              const detail = costs[i]
              return (
                <details
                  key={`${run.date}-${run.product}`}
                  className="rounded-[var(--r)] border border-line bg-surface"
                >
                  <summary className="cursor-pointer px-4 py-3 text-sm">
                    {formatDate(run.date)} — {run.product} —{" "}
                    <span className="tabular-nums">${run.total_cost_usd.toFixed(2)}</span>
                  </summary>
                  <div className="border-t border-line p-4">
                    {!detail || detail.steps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
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
        )}
      </section>
    </div>
  )
}
