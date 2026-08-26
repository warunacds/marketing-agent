import { notFound } from "next/navigation"
import { FactcheckBadge } from "@/components/factcheck-badge"
import { ItemActions } from "@/components/item-actions"
import { Markdown } from "@/components/markdown"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getItem, type QueueState } from "@/lib/state"

export const dynamic = "force-dynamic"

const LABELS: Record<string, string> = {
  "01-brief.md": "Brief",
  "02-seo-brief.md": "SEO",
  "03-post.md": "Post",
  "04-social.md": "Social",
  "05-newsletter.md": "Newsletter",
  "06-factcheck.md": "Fact-check",
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ state: string; slug: string }>
}) {
  const { state, slug } = await params
  if (!["pending", "approved", "published", "rejected"].includes(state)) notFound()
  const item = getItem(state as QueueState, slug)
  if (!item) notFound()

  const files = Object.keys(item.files)
  const defaultTab = files.includes("03-post.md") ? "03-post.md" : files[0]
  const published = item.manifest?.published ?? {}

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">{slug}</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{state}</Badge>
            <FactcheckBadge verdict={item.manifest?.factcheck} />
            {Object.entries(published).map(([channel, info]) => (
              <Badge key={channel} variant={info.status === "ok" ? "success" : "destructive"}>
                {channel}: {info.status}
              </Badge>
            ))}
          </div>
        </div>
        <ItemActions slug={slug} state={state} factcheck={item.manifest?.factcheck} />
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          {files.map((f) => (
            <TabsTrigger key={f} value={f}>
              {LABELS[f] ?? f}
            </TabsTrigger>
          ))}
        </TabsList>
        {files.map((f) => (
          <TabsContent key={f} value={f} className="rounded-lg border p-6">
            <Markdown>{item.files[f]}</Markdown>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
