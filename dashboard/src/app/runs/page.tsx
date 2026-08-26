import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getCosts, getJobs } from "@/lib/state"

export const dynamic = "force-dynamic"

export default function RunsPage() {
  const costs = getCosts()
  const jobs = getJobs()

  const totals = new Map<string, { cost: number; steps: number }>()
  for (const row of costs) {
    const key = `${row.date} · ${row.product}`
    const t = totals.get(key) ?? { cost: 0, steps: 0 }
    t.cost += row.cost_usd ?? 0
    t.steps += 1
    totals.set(key, t)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Runs</h1>
        <p className="text-sm text-muted-foreground">
          Pipeline jobs, per-step token spend, and totals per run.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Jobs ({jobs.length})</h2>
        {jobs.length === 0 && (
          <p className="text-sm text-muted-foreground/70">
            No jobs yet. Start one from the Queue page.
          </p>
        )}
        <div className="space-y-3">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-mono">{job.id}</CardTitle>
                  {job.running ? (
                    <Badge variant="secondary">running</Badge>
                  ) : job.log.includes("=== JOB EXIT 0") ? (
                    <Badge variant="success">done</Badge>
                  ) : (
                    <Badge variant="destructive">failed</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="max-h-56 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
                  {job.log.trim().split("\n").slice(-30).join("\n") || "(no output yet)"}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Run totals</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Run</TableHead>
              <TableHead className="text-right">Steps</TableHead>
              <TableHead className="text-right">Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...totals.entries()].map(([key, t]) => (
              <TableRow key={key}>
                <TableCell>{key}</TableCell>
                <TableCell className="text-right tabular-nums">{t.steps}</TableCell>
                <TableCell className="text-right tabular-nums">${t.cost.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">All steps</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Model</TableHead>
              <TableHead className="text-right">Tokens in/out</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {costs.map((row, i) => (
              <TableRow key={i}>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.product}</TableCell>
                <TableCell>{row.agent}</TableCell>
                <TableCell className="font-mono text-xs">{row.model}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.input_tokens ?? "–"} / {row.output_tokens ?? "–"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.cost_usd != null ? `$${row.cost_usd.toFixed(3)}` : "–"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.duration_s}s</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
    </div>
  )
}
