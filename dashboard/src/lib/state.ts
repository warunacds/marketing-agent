// Read-side data layer: everything the dashboard shows comes from the FastAPI
// backend (marketing_agent/api.py). All calls are uncached so the queue is
// always fresh.
import { api, ApiError } from "./api"
import type { PublishReceipt } from "./format"

export type QueueState = "pending" | "approved" | "published" | "rejected"

export interface Manifest {
  product?: string
  date?: string
  factcheck?: "PASS" | "FAIL" | "STALE"
  files?: string[]
  approved?: boolean
  reason?: string
  approved_by?: string
  approved_at?: string
  rejected_at?: string
  revising?: boolean
  revisions?: { at: string; feedback: string }[]
  // One channel key → an array of destination receipts (legacy items may hold
  // a single object; render with asReceipts()).
  published?: Record<string, PublishReceipt | PublishReceipt[]>
}

export interface QueueItem {
  slug: string
  state: QueueState
  manifest: Manifest
}

type RawQueueItem = { slug: string } & Manifest

export async function getQueue(product?: string): Promise<QueueItem[]> {
  const data = await api<Record<QueueState, RawQueueItem[]>>("/api/queue")
  const states: QueueState[] = ["pending", "approved", "published", "rejected"]
  const items = states.flatMap((state) =>
    (data[state] ?? []).map(({ slug, ...manifest }) => ({ slug, state, manifest }))
  )
  return product ? items.filter((i) => i.manifest.product === product) : items
}

export interface ItemDetail {
  slug: string
  state: QueueState
  manifest: Manifest
  files: Record<string, string>
}

export async function getItem(state: QueueState, slug: string): Promise<ItemDetail | null> {
  try {
    const data = await api<{
      slug: string
      state: QueueState
      manifest: Manifest
      files: { name: string; content: string }[]
    }>(`/api/items/${encodeURIComponent(state)}/${encodeURIComponent(slug)}`)
    const files: Record<string, string> = {}
    for (const f of data.files) files[f.name] = f.content
    return { slug: data.slug, state: data.state, manifest: data.manifest, files }
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null
    throw e
  }
}

export interface Brand {
  product: string
  files: string[]
}

export async function getBrands(): Promise<Brand[]> {
  return api<Brand[]>("/api/brands")
}

export async function getProducts(): Promise<string[]> {
  return (await getBrands()).map((b) => b.product)
}

export interface BrandDetail {
  product: string
  files: { name: string; content: string }[]
}

export async function getBrand(product: string): Promise<BrandDetail | null> {
  try {
    return await api<BrandDetail>(`/api/brands/${encodeURIComponent(product)}`)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null
    throw e
  }
}

export type JobStatus = "running" | "done" | "failed" | "interrupted"

export interface Job {
  id: string
  status: JobStatus
}

export async function getJobs(product?: string): Promise<Job[]> {
  const jobs = await api<Job[]>("/api/jobs")
  // Job ids end in "-<kind>-<product>" (see describeJob in format.ts).
  return product ? jobs.filter((j) => j.id.endsWith(`-${product}`)) : jobs
}

export interface JobDetail extends Job {
  log: string
}

export async function getJob(id: string): Promise<JobDetail | null> {
  try {
    return await api<JobDetail>(`/api/jobs/${encodeURIComponent(id)}`)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null
    throw e
  }
}

export type ScheduleTarget = "blog" | "x" | "linkedin" | "reddit" | "newsletter"
export type Cadence = "daily" | "every_n_days" | "weekly"

export interface ScheduleEntry {
  target: ScheduleTarget
  enabled: boolean
  cadence: Cadence
  every_n_days: number
  day: string
  hour: number
  auto_publish: boolean
  instructions: string
  last_run?: string | null
}

export interface Schedule {
  product: string
  entries: ScheduleEntry[]
  report_enabled: boolean
  report_day: string
  report_hour: number
  report_last_run?: string
}

export async function getSchedules(): Promise<Schedule[]> {
  return api<Schedule[]>("/api/schedule")
}

export interface ChannelConfig {
  type: string
  [key: string]: unknown
}

/** Each channel is now a list of destinations (unconfigured → [{type:"manual"}]). */
export type Channels = Record<"blog" | "social" | "newsletter", ChannelConfig[]>

export async function getChannels(product: string): Promise<Channels> {
  return api<Channels>(`/api/channels/${encodeURIComponent(product)}`)
}

/** Which secret env vars are set on the server (never their values). */
export async function getSecrets(names: string[]): Promise<Record<string, boolean>> {
  const rows = await api<{ name: string; set: boolean }[]>(
    `/api/secrets?names=${encodeURIComponent(names.join(","))}`
  )
  return Object.fromEntries(rows.map((r) => [r.name, r.set]))
}

export interface RunSummary {
  date: string
  product: string
  files: string[]
  total_cost_usd: number
}

export async function getRuns(product?: string): Promise<RunSummary[]> {
  const runs = await api<RunSummary[]>("/api/runs")
  return product ? runs.filter((r) => r.product === product) : runs
}

export interface RunCostStep {
  agent: string
  model: string
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  duration_s: number
}

export interface RunCosts {
  date: string
  product: string
  steps: RunCostStep[]
  total_cost_usd: number
}

export async function getRunFile(date: string, product: string, file: string): Promise<string> {
  const { content } = await api<{ content: string }>(
    `/api/runs/${encodeURIComponent(date)}/${encodeURIComponent(product)}/${encodeURIComponent(file)}`
  )
  return content
}

export interface BrowserSession {
  platform: string
  label: string
  logged_in: boolean
  login_command: string
  /** True while a login window this backend opened is still on screen. */
  login_in_progress: boolean
}

export async function getBrowserSessions(): Promise<BrowserSession[]> {
  return api<BrowserSession[]>("/api/browser-sessions")
}

export interface Todo {
  file: string
  line: number
  text: string
}

export async function getTodos(product: string): Promise<Todo[]> {
  return api<Todo[]>(`/api/brands/${encodeURIComponent(product)}/todos`)
}

export async function getRunCosts(date: string, product: string): Promise<RunCosts | null> {
  try {
    return await api<RunCosts>(
      `/api/runs/${encodeURIComponent(date)}/${encodeURIComponent(product)}/costs`
    )
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return null
    throw e
  }
}
