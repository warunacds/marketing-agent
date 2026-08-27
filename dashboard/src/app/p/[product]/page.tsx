import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowRightIcon } from "lucide-react"
import { CreateContentDialog } from "@/components/create-content-dialog"
import { FactcheckPill } from "@/components/factcheck-pill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { asReceipts, channelLabel, contentSummary, formatDate } from "@/lib/format"
import {
  getBrowserSessions,
  getChannels,
  getProducts,
  getQueue,
  getSchedules,
  getTodos,
  type BrowserSession,
  type Channels,
  type QueueItem,
} from "@/lib/state"

export const dynamic = "force-dynamic"

const DAY_CAP = (d: string) => d.charAt(0).toUpperCase() + d.slice(1)
const AT = (hour: number) => `${hour}:00`

// Which social destination types post through a saved browser login.
const BROWSER_PLATFORM: Record<string, string> = {
  browser_x: "x",
  browser_reddit: "reddit",
  browser_linkedin: "linkedin",
}

/** Reads channels + sessions to say what posting is set up and what's blocked. */
function analyzePublishing(channels: Channels, sessions: BrowserSession[]) {
  const all = [...channels.blog, ...channels.social, ...channels.newsletter]
  const configured = all.filter((c) => c.type && c.type !== "manual")
  const needLoginMap = new Map<string, string>()
  for (const c of all) {
    const platform = BROWSER_PLATFORM[String(c.type)]
    if (!platform) continue
    const s = sessions.find((x) => x.platform === platform)
    if (s && !s.logged_in) needLoginMap.set(platform, s.label)
  }
  return {
    allManual: configured.length === 0,
    needLogin: [...needLoginMap.values()],
  }
}

const newestFirst = (a: QueueItem, b: QueueItem) =>
  (b.manifest.date ?? "").localeCompare(a.manifest.date ?? "")

function publishedTo(item: QueueItem): string {
  const labels = Object.entries(item.manifest.published ?? {}).flatMap(([channel, info]) =>
    asReceipts(info)
      .filter((r) => r.status === "ok")
      .map((r) => r.label ?? channelLabel(channel))
  )
  return [...new Set(labels)].join(", ")
}

function NeedsRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-[var(--r-input)] border border-attention-soft bg-attention-soft px-4 py-3 text-sm text-attention transition-opacity hover:opacity-90"
    >
      <span>{children}</span>
      <ArrowRightIcon className="size-4 shrink-0" />
    </Link>
  )
}

export default async function HomePage({ params }: { params: Promise<{ product: string }> }) {
  const { product } = await params
  const products = await getProducts()
  if (!products.includes(product)) notFound()

  const [queue, schedules, channels, sessions, todos] = await Promise.all([
    getQueue(product),
    getSchedules(),
    getChannels(product),
    getBrowserSessions(),
    getTodos(product),
  ])

  const pending = queue.filter((i) => i.state === "pending").sort(newestFirst)
  const published = queue.filter((i) => i.state === "published").sort(newestFirst)
  const schedule = schedules.find((s) => s.product === product)
  const { allManual, needLogin } = analyzePublishing(channels, sessions)

  const reviewBase = `/p/${product}/review`
  const publishingHref = `/p/${product}/publishing`
  const knowledgeHref = `/p/${product}/knowledge`

  // "Needs a look" rows — only what's actually off.
  const needsRows: React.ReactNode[] = []
  if (todos.length > 0) {
    needsRows.push(
      <NeedsRow key="todos" href={knowledgeHref}>
        {todos.length} open question{todos.length === 1 ? "" : "s"} about your product — answering
        them makes drafts more accurate
      </NeedsRow>
    )
  }
  for (const label of needLogin) {
    needsRows.push(
      <NeedsRow key={`login-${label}`} href={publishingHref}>
        Log in to {label} so it can post your content
      </NeedsRow>
    )
  }
  if (allManual) {
    needsRows.push(
      <NeedsRow key="manual" href={publishingHref}>
        No publishing set up yet — content will wait for you to post it by hand
      </NeedsRow>
    )
  }

  return (
    <div className="space-y-8">
      {/* 1. Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{product}</h1>
          <p className="text-sm text-muted-foreground">Your AI marketing desk.</p>
        </div>
        <CreateContentDialog products={[product]} />
      </div>

      {/* 2. Waiting for your review */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Waiting for your review</CardTitle>
            {pending.length > 0 && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-[var(--r-pill)] bg-attention-soft px-2 py-0.5 text-xs font-semibold text-attention tabular-nums">
                {pending.length}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {pending.length === 0 ? (
            <EmptyState
              title="Nothing to review right now."
              description="When the AI drafts new content, it lands here for your approval."
              action={
                <CreateContentDialog
                  products={[product]}
                  trigger={
                    <Button variant="secondary" size="sm">
                      Create this week&apos;s content
                    </Button>
                  }
                />
              }
            />
          ) : (
            <div className="space-y-1">
              {pending.slice(0, 3).map((item) => {
                const summary = contentSummary(item.manifest.files)
                return (
                  <Link
                    key={item.slug}
                    href={`${reviewBase}/pending/${item.slug}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--r-input)] px-3 py-2.5 transition-colors hover:bg-surface-sunk"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-ink">
                        {formatDate(item.manifest.date) || item.slug}
                      </p>
                      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
                    </div>
                    <FactcheckPill verdict={item.manifest.factcheck} />
                  </Link>
                )
              })}
              <Link
                href={reviewBase}
                className="inline-flex items-center gap-1 px-3 pt-2 text-sm font-medium text-primary hover:underline"
              >
                Review all ({pending.length})
                <ArrowRightIcon className="size-4" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Coming up */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {schedule?.enabled ? (
            <p className="text-ink">
              New content drafts every {DAY_CAP(schedule.day)} at {AT(schedule.hour)}.
            </p>
          ) : (
            <p className="text-muted-foreground">
              No automatic schedule yet.{" "}
              <Link href={publishingHref} className="text-primary hover:underline">
                Set one up
              </Link>
            </p>
          )}
          {schedule?.report_enabled && (
            <p className="text-ink">
              Weekly report every {DAY_CAP(schedule.report_day)} at {AT(schedule.report_hour)}.
            </p>
          )}
          {needLogin.length > 0 ? (
            <p className="text-muted-foreground">
              {needLogin.length} login{needLogin.length === 1 ? "" : "s"} needed before this can
              post.{" "}
              <Link href={publishingHref} className="text-primary hover:underline">
                Finish setup
              </Link>
            </p>
          ) : allManual ? (
            <p className="text-muted-foreground">You&apos;ll copy and post each piece yourself.</p>
          ) : (
            <p className="text-muted-foreground">Set up to post when you publish.</p>
          )}
        </CardContent>
      </Card>

      {/* 4. Recently published */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recently published</CardTitle>
        </CardHeader>
        <CardContent>
          {published.length === 0 ? (
            <EmptyState
              title="Nothing published yet."
              description="Once you approve and publish a draft, it shows up here."
            />
          ) : (
            <div className="space-y-1">
              {published.slice(0, 3).map((item) => {
                const where = publishedTo(item)
                return (
                  <Link
                    key={item.slug}
                    href={`${reviewBase}/published/${item.slug}`}
                    className="flex items-center justify-between gap-3 rounded-[var(--r-input)] px-3 py-2.5 transition-colors hover:bg-surface-sunk"
                  >
                    <p className="text-sm font-medium text-ink">
                      {formatDate(item.manifest.date) || item.slug}
                    </p>
                    {where && (
                      <p className="shrink-0 text-xs text-muted-foreground">Sent to {where}</p>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Needs a look — only when something is off */}
      {needsRows.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Needs a look</h2>
          {needsRows}
        </section>
      )}
    </div>
  )
}
