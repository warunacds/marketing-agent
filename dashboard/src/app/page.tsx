import Link from "next/link"
import { FactcheckBadge } from "@/components/factcheck-badge"
import { RunPipeline } from "@/components/run-pipeline"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getProducts, getQueue, type QueueItem } from "@/lib/state"

export const dynamic = "force-dynamic"

function ItemCard({ item }: { item: QueueItem }) {
  const m = item.manifest
  const published = m.published ?? {}
  return (
    <Link href={`/item/${item.state}/${item.slug}`}>
      <Card className="transition-colors hover:bg-accent/40">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">{m.product}</CardTitle>
            <FactcheckBadge verdict={m.factcheck} />
          </div>
          <CardDescription>{item.slug}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          {item.state === "approved" &&
            ["blog", "social", "newsletter"].map((c) => (
              <Badge key={c} variant={published[c]?.status === "ok" ? "success" : "outline"}>
                {c}
              </Badge>
            ))}
          {item.state === "rejected" && m.reason && (
            <span className="text-xs text-muted-foreground">reason: {m.reason}</span>
          )}
          {item.state === "published" && (
            <span className="text-xs text-muted-foreground">
              published {Object.keys(published).join(", ")}
            </span>
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

export default function QueuePage() {
  const queue = getQueue()
  const products = getProducts()
  const by = (s: string) => queue.filter((i) => i.state === s)

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Review queue</h1>
          <p className="text-sm text-muted-foreground">
            Drafts wait here until a human approves them. Nothing publishes on its own.
          </p>
        </div>
        <RunPipeline products={products} />
      </div>
      <Section
        title="Pending review"
        items={by("pending")}
        empty="Nothing waiting. Run the content pipeline to generate drafts."
      />
      <Separator />
      <Section
        title="Approved — ready to publish"
        items={by("approved")}
        empty="No approved items."
      />
      <Separator />
      <Section title="Published" items={by("published")} empty="Nothing published yet." />
      <Separator />
      <Section title="Rejected" items={by("rejected")} empty="Nothing rejected." />
    </div>
  )
}
