// Plain-language labels and formatting shared by the pages.

export function formatDate(iso?: string): string {
  if (!iso) return ""
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })
}

const CONTENT_FILES: [string, string][] = [
  ["03-post.md", "blog post"],
  ["04-social.md", "social posts"],
  ["05-newsletter.md", "newsletter"],
]

/** "Blog post, social posts, newsletter" from a manifest file list. */
export function contentSummary(files?: string[]): string | null {
  const parts = CONTENT_FILES.filter(([name]) => files?.includes(name)).map(([, label]) => label)
  if (parts.length === 0) return null
  const joined = parts.join(", ")
  return joined.charAt(0).toUpperCase() + joined.slice(1)
}

export interface PublishReceipt {
  type?: string
  label?: string
  status: string
  detail?: string
  at?: string
  adapter?: string
}

/** Publish receipts are now an array per channel; old items may hold a lone object. */
export function asReceipts(
  value: PublishReceipt | PublishReceipt[] | undefined
): PublishReceipt[] {
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

export function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    blog: "blog",
    social: "social",
    newsletter: "newsletter",
  }
  return labels[channel] ?? channel
}

const JOB_TITLES: Record<string, (product: string) => string> = {
  content: (p) => `Creating content for ${p}`,
  report: (p) => `Performance report for ${p}`,
  revise: (p) => `Revising drafts for ${p}`,
  factcheck: (p) => `Re-checking facts for ${p}`,
  scheduled: (p) => `Scheduled content run for ${p}`,
  brandgen: (p) => `Drafting product info for ${p}`,
}

/** "Creating content for domainpilot" + a human timestamp, from a job id. */
export function describeJob(id: string): { title: string; when: string } {
  const m = id.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-.*?-(content|report|revise|factcheck|scheduled|brandgen)-(.+)$/
  )
  if (!m) return { title: id, when: "" }
  const [, date, hh, mm, kind, product] = m
  return {
    title: JOB_TITLES[kind]?.(product) ?? id,
    when: `${formatDate(date)}, ${hh}:${mm} UTC`,
  }
}

export const JOB_STATUS: Record<
  string,
  { label: string; variant: "secondary" | "success" | "destructive" | "outline" }
> = {
  running: { label: "Running", variant: "secondary" },
  done: { label: "Finished", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  interrupted: { label: "Stopped early", variant: "outline" },
}

const BRAND_FILE_LABELS: Record<string, string> = {
  "features.md": "Features",
  "pricing.md": "Pricing",
  "voice.md": "Voice & tone",
  "icp.md": "Target customers",
  "positioning.md": "Positioning",
  "competitors.md": "Competitors",
  "never-say.md": "Things we never say",
  "learnings.md": "Lessons learned",
  "channels.json": "Publishing settings",
}

export function brandFileLabel(name: string): string {
  return BRAND_FILE_LABELS[name] ?? name
}
