import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"
import { OpenQuestionsCard } from "@/components/open-questions-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { brandFileLabel } from "@/lib/format"
import { getBrand, getTodos } from "@/lib/state"

export const dynamic = "force-dynamic"

// A one-line "what is this" hint per note, keyed by filename.
const FILE_HINTS: Record<string, string> = {
  "features.md": "What your product does",
  "pricing.md": "Plans and what they cost",
  "voice.md": "How your content should sound",
  "icp.md": "Who you're selling to",
  "positioning.md": "How you're different",
  "competitors.md": "Who else is in the space",
  "never-say.md": "Claims and phrases to avoid",
  "learnings.md": "What past content taught the AI",
}

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ product: string }>
}) {
  const { product } = await params
  const [brand, todos] = await Promise.all([getBrand(product), getTodos(product)])
  if (!brand) notFound()

  // Notes only — publishing config (channels.json) lives under Publishing.
  const notes = brand.files.filter((f) => !f.name.endsWith(".json"))

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          What the AI knows
        </h1>
        <p className="text-sm text-muted-foreground">
          Everything the AI reads before it writes. Every claim in your content is checked against
          these notes.
        </p>
      </div>

      {todos.length > 0 && <OpenQuestionsCard product={product} todos={todos} />}

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-ink">The notes</h2>
          <p className="text-sm text-muted-foreground">
            Edit any of these to shape what the AI writes.
          </p>
        </div>
        {notes.length === 0 ? (
          <EmptyState
            title="No notes yet."
            description="Add a product and the AI drafts these from your description."
          />
        ) : (
          <Card>
            <CardHeader className="sr-only">
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ul className="divide-y divide-line">
                {notes.map((f) => (
                  <li key={f.name}>
                    <Link
                      href={`/p/${product}/knowledge/${encodeURIComponent(f.name)}`}
                      className="flex items-center justify-between gap-3 rounded-[var(--r-input)] px-3 py-3 transition-colors hover:bg-surface-sunk"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink">{brandFileLabel(f.name)}</p>
                        {FILE_HINTS[f.name] && (
                          <p className="text-xs text-muted-foreground">{FILE_HINTS[f.name]}</p>
                        )}
                      </div>
                      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
