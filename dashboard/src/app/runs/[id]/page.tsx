import Link from "next/link"
import { notFound } from "next/navigation"
import { AutoRefresh } from "@/components/auto-refresh"
import { Badge } from "@/components/ui/badge"
import { describeJob, JOB_STATUS } from "@/lib/format"
import { getJob } from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const job = await getJob(id)
  if (!job) notFound()

  const { title, when } = describeJob(job.id)
  const status = JOB_STATUS[job.status] ?? { label: job.status, variant: "secondary" as const }

  return (
    <div className="space-y-6">
      <AutoRefresh active={job.status === "running"} />
      <div className="space-y-2">
        <Link href="/runs" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to Activity
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant={status.variant}>{status.label}</Badge>
          <span>{when}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          This is the technical log of what the AI did — you only need it if something failed.
        </p>
      </div>
      <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed">
        {job.log.trim() || "(no output yet)"}
      </pre>
    </div>
  )
}
