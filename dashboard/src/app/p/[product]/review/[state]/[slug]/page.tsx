import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { AutoRefresh } from "@/components/auto-refresh"
import { DraftEditor } from "@/components/draft-editor"
import { FactcheckPill } from "@/components/factcheck-pill"
import { ItemActions } from "@/components/item-actions"
import { Markdown } from "@/components/markdown"
import { RecheckFacts } from "@/components/recheck-facts"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { asReceipts, channelLabel, formatDate } from "@/lib/format"
import { getItem, getJobs, type QueueState } from "@/lib/state"

export const dynamic = "force-dynamic"

const STATE_LABELS: Record<string, string> = {
  pending: "Waiting for review",
  approved: "Approved — ready to publish",
  published: "Published",
  rejected: "Didn't use",
}

const MAIN_TABS: [string, string][] = [
  ["03-post.md", "Blog post"],
  ["04-social.md", "Social posts"],
  ["05-newsletter.md", "Newsletter"],
  ["06-factcheck.md", "Fact-check report"],
]

const EDITABLE_FILES = ["03-post.md", "04-social.md", "05-newsletter.md"]

export default async function ItemPage({
  params,
}: {
  params: Promise<{ product: string; state: string; slug: string }>
}) {
  const { product, state, slug } = await params
  if (!["pending", "approved", "published", "rejected"].includes(state)) notFound()
  const item = await getItem(state as QueueState, slug)
  if (!item) notFound()

  const m = item.manifest
  const revising = Boolean(m.revising)
  const jobs = state === "pending" ? await getJobs() : []
  const factcheckRunning = jobs.some(
    (j) => j.status === "running" && j.id.endsWith(`-factcheck-${m.product}`)
  )

  const fileNames = Object.keys(item.files)
  const tabs = MAIN_TABS.filter(([name]) => fileNames.includes(name)).map(([name, label]) => ({
    value: name,
    label,
    files: [name],
  }))
  const notes = fileNames.filter((name) => !MAIN_TABS.some(([n]) => n === name))
  if (notes.length > 0) tabs.push({ value: "working-notes", label: "Working notes", files: notes })
  const defaultTab = tabs[0]?.value
  const published = m.published ?? {}
  const revisions = m.revisions ?? []

  return (
    <div className="space-y-6">
      <AutoRefresh active={revising || factcheckRunning} />
      <Link
        href={`/p/${product}/review`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Back to Review
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {m.product ?? slug}
            {m.date ? ` — ${formatDate(m.date)}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            Read each tab, then use the buttons — they act on this whole bundle at once.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">{STATE_LABELS[state] ?? state}</Badge>
            <FactcheckPill verdict={m.factcheck} />
            {state === "pending" && m.factcheck === "STALE" && !revising && (
              <RecheckFacts slug={slug} running={factcheckRunning} />
            )}
            {Object.entries(published).flatMap(([channel, info]) =>
              asReceipts(info).map((receipt, idx) => (
                <Badge
                  key={`${channel}-${idx}`}
                  variant={receipt.status === "ok" ? "success" : "destructive"}
                >
                  {receipt.label ?? channelLabel(channel)}:{" "}
                  {receipt.status === "ok" ? "sent" : receipt.status}
                </Badge>
              ))
            )}
            {state === "rejected" && m.reason && (
              <span className="text-xs text-muted-foreground">Why: {m.reason}</span>
            )}
            {["approved", "published"].includes(state) && m.approved_by && (
              <span className="text-xs text-muted-foreground">
                Approved by {m.approved_by}
                {m.approved_at ? `, ${formatDate(m.approved_at.slice(0, 10))}` : ""}
              </span>
            )}
          </div>
          {revisions.length > 0 && (
            <details className="pt-1 text-sm text-muted-foreground">
              <summary className="cursor-pointer">
                Revised {revisions.length} {revisions.length === 1 ? "time" : "times"}
              </summary>
              <ul className="mt-1 space-y-1">
                {revisions.map((r, i) => (
                  <li key={i}>
                    <span className="text-xs">{formatDate(r.at?.slice(0, 10))}:</span> {r.feedback}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <ItemActions
          slug={slug}
          product={product}
          state={state}
          revising={revising}
          published={published}
          files={fileNames}
        />
      </div>

      {revising && (
        <div className="rounded-[var(--r)] border border-line bg-muted px-4 py-3 text-sm">
          The AI is revising these drafts — check back in a couple of minutes. This page updates on
          its own.
        </div>
      )}

      {defaultTab && (
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent
              key={t.value}
              value={t.value}
              className="space-y-8 rounded-[var(--r)] border border-line p-6"
            >
              {t.files.map((f) => {
                const editable = state === "pending" && EDITABLE_FILES.includes(f)
                const rendered = <Markdown>{item.files[f]}</Markdown>
                return (
                  <div key={f}>
                    {t.files.length > 1 && (
                      <p className="mb-2 font-mono text-xs text-muted-foreground">{f}</p>
                    )}
                    {editable ? (
                      <DraftEditor slug={slug} name={f} content={item.files[f]} disabled={revising}>
                        {rendered}
                      </DraftEditor>
                    ) : (
                      rendered
                    )}
                  </div>
                )
              })}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
