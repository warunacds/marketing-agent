import Link from "next/link"
import { notFound } from "next/navigation"
import { CreateContentDialog } from "@/components/create-content-dialog"
import { FactcheckPill } from "@/components/factcheck-pill"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { asReceipts, channelLabel, contentSummary, formatDate } from "@/lib/format"
import { getProducts, getQueue, type QueueItem, type QueueState } from "@/lib/state"

export const dynamic = "force-dynamic"

function publishedTo(item: QueueItem): string {
  const labels = Object.entries(item.manifest.published ?? {}).flatMap(([channel, info]) =>
    asReceipts(info)
      .filter((r) => r.status === "ok")
      .map((r) => r.label ?? channelLabel(channel))
  )
  return [...new Set(labels)].join(", ")
}

function ItemRow({ item, product }: { item: QueueItem; product: string }) {
  const m = item.manifest
  const href = `/p/${product}/review/${item.state}/${item.slug}`
  const summary = contentSummary(m.files)
  const primary =
    item.state === "pending" ? "Review" : item.state === "approved" ? "Publish" : null
  const where = item.state === "published" ? publishedTo(item) : ""

  return (
    <Card className="relative flex items-center gap-4 p-4 transition-colors hover:bg-surface-sunk">
      {/* Stretched link: the whole card opens the item. */}
      <Link
        href={href}
        aria-label={`Open ${formatDate(m.date) || item.slug}`}
        className="absolute inset-0 rounded-[var(--r)]"
      />
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-medium text-ink">{formatDate(m.date) || item.slug}</p>
        {summary && <p className="text-sm text-muted-foreground">{summary}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <FactcheckPill verdict={m.factcheck} />
          {item.state === "published" && where && (
            <span className="text-xs text-muted-foreground">Sent to {where}</span>
          )}
          {item.state === "rejected" && m.reason && (
            <span className="text-xs text-muted-foreground">Why: {m.reason}</span>
          )}
        </div>
      </div>
      {primary && (
        <Button asChild size="sm" className="relative z-10 shrink-0">
          <Link href={href}>{primary}</Link>
        </Button>
      )}
    </Card>
  )
}

function Section({
  title,
  items,
  empty,
  product,
}: {
  title: string
  items: QueueItem[]
  empty: string
  product: string
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        {title} <span className="ml-1 tabular-nums">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground/70">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((i) => (
            <ItemRow key={`${i.state}-${i.slug}`} item={i} product={product} />
          ))}
        </div>
      )}
    </section>
  )
}

export default async function ReviewPage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params
  const products = await getProducts()
  if (!products.includes(product)) notFound()
  const queue = await getQueue(product)
  const by = (s: QueueState) => queue.filter((i) => i.state === s)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Review</h1>
          <p className="text-sm text-muted-foreground">
            The AI drafts your marketing content — nothing goes out until you approve it here.
          </p>
        </div>
        <CreateContentDialog products={[product]} />
      </div>
      <Section
        title="Waiting for your review"
        items={by("pending")}
        empty={'Nothing to review right now. Press "Create this week\'s content" to get started.'}
        product={product}
      />
      <Section
        title="Approved — ready to publish"
        items={by("approved")}
        empty="Nothing approved yet. Approved content waits here until you publish it."
        product={product}
      />
      <Section
        title="Published"
        items={by("published")}
        empty="Nothing published yet."
        product={product}
      />
      <Section
        title="Didn't use"
        items={by("rejected")}
        empty="Nothing set aside."
        product={product}
      />
    </div>
  )
}
