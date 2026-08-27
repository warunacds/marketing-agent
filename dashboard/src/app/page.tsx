import Link from "next/link"
import { CreateContentDialog } from "@/components/create-content-dialog"
import { FactcheckBadge } from "@/components/factcheck-badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { channelLabel, contentSummary, formatDate } from "@/lib/format"
import { getProducts, getQueue, type QueueItem, type QueueState } from "@/lib/state"

export const dynamic = "force-dynamic"

function ItemCard({ item }: { item: QueueItem }) {
  const m = item.manifest
  const summary = contentSummary(m.files)
  const publishedChannels = Object.keys(m.published ?? {})
  return (
    <Link href={`/item/${item.state}/${item.slug}`}>
      <Card className="h-full transition-colors hover:bg-accent/40">
        <CardHeader>
          <CardTitle className="text-base">{m.product ?? item.slug}</CardTitle>
          <CardDescription>{formatDate(m.date)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
          <FactcheckBadge verdict={m.factcheck} />
          {item.state === "rejected" && m.reason && (
            <p className="text-xs text-muted-foreground">Why: {m.reason}</p>
          )}
          {item.state === "published" && publishedChannels.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Published to {publishedChannels.map(channelLabel).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function Section({ title, items, empty }: { title: string; items: QueueItem[]; empty: string }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="ml-1 tabular-nums">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{empty}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((i) => (
            <ItemCard key={`${i.state}-${i.slug}`} item={i} />
          ))}
        </div>
      )}
    </section>
  )
}

export default async function ReviewPage() {
  const [queue, products] = await Promise.all([getQueue(), getProducts()])
  const by = (s: QueueState) => queue.filter((i) => i.state === s)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Review</h1>
          <p className="text-sm text-muted-foreground">
            The AI drafts your marketing content — nothing goes out until you approve it here.
          </p>
        </div>
        <CreateContentDialog products={products} />
      </div>
      <Section
        title="Waiting for your review"
        items={by("pending")}
        empty={'Nothing to review right now. Press "Create this week\'s content" to get started.'}
      />
      <Separator />
      <Section
        title="Approved — ready to publish"
        items={by("approved")}
        empty="Nothing approved yet. Approved content waits here until you publish it."
      />
      <Separator />
      <Section title="Published" items={by("published")} empty="Nothing published yet." />
      <Separator />
      <Section title="Rejected" items={by("rejected")} empty="Nothing rejected." />
    </div>
  )
}
