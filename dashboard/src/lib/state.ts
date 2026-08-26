// Read-side data layer: everything the dashboard shows comes straight from
// the repo's on-disk state (queue/, runs/, brands/). No database.
import fs from "node:fs"
import path from "node:path"

// dashboard/ lives inside the marketing-agent repo
export const REPO_ROOT = path.resolve(process.cwd(), "..")
const QUEUE = path.join(REPO_ROOT, "queue")
const RUNS = path.join(REPO_ROOT, "runs")
const BRANDS = path.join(REPO_ROOT, "brands")

export type QueueState = "pending" | "approved" | "published" | "rejected"

export interface Manifest {
  product: string
  date: string
  factcheck?: "PASS" | "FAIL"
  files?: string[]
  approved?: boolean
  reason?: string
  approved_by?: string
  approved_at?: string
  rejected_at?: string
  published?: Record<string, { status: string; adapter?: string; at?: string; detail?: string }>
}

export interface QueueItem {
  slug: string
  state: QueueState
  manifest: Manifest
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T
  } catch {
    return null
  }
}

function listDirs(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .reverse()
  } catch {
    return []
  }
}

export function getProducts(): string[] {
  return listDirs(BRANDS)
    .filter((name) => !name.startsWith("_"))
    .sort()
}

export function getQueue(): QueueItem[] {
  const states: QueueState[] = ["pending", "approved", "published", "rejected"]
  const items: QueueItem[] = []
  for (const state of states) {
    for (const slug of listDirs(path.join(QUEUE, state))) {
      const manifest =
        readJson<Manifest>(path.join(QUEUE, state, slug, "manifest.json")) ??
        ({ product: "?", date: "?" } as Manifest)
      items.push({ slug, state, manifest })
    }
  }
  return items
}

export function getItem(state: QueueState, slug: string) {
  const dir = path.join(QUEUE, state, slug)
  if (!fs.existsSync(dir) || !dir.startsWith(QUEUE)) return null
  const manifest = readJson<Manifest>(path.join(dir, "manifest.json"))
  const files: Record<string, string> = {}
  for (const f of fs.readdirSync(dir).sort()) {
    if (f.endsWith(".md")) files[f] = fs.readFileSync(path.join(dir, f), "utf8")
  }
  return { slug, state, manifest, files }
}

export interface CostRow {
  date: string
  product: string
  agent: string
  model: string
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  duration_s: number
}

export function getCosts(): CostRow[] {
  const rows: CostRow[] = []
  for (const date of listDirs(RUNS)) {
    for (const product of listDirs(path.join(RUNS, date))) {
      const file = path.join(RUNS, date, product, "costs.jsonl")
      if (!fs.existsSync(file)) continue
      for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        if (!line.trim()) continue
        try {
          rows.push({ date, product, ...JSON.parse(line) })
        } catch {
          /* skip bad lines */
        }
      }
    }
  }
  return rows
}

export function getBrandFiles(product: string): string[] {
  const dir = path.join(BRANDS, product)
  if (!fs.existsSync(dir) || product.startsWith("_") || product.includes("/")) return []
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md") || f.endsWith(".json")).sort()
}

export function getBrandFile(product: string, file: string): string | null {
  if (product.includes("/") || product.includes("..") || file.includes("/") || file.includes(".."))
    return null
  const p = path.join(BRANDS, product, file)
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null
}

export interface Job {
  id: string
  log: string
  running: boolean
}

export function getJobs(): Job[] {
  const dir = path.join(RUNS, "jobs")
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".log"))
    .sort()
    .reverse()
    .slice(0, 20)
    .map((f) => {
      const log = fs.readFileSync(path.join(dir, f), "utf8")
      return {
        id: f.replace(/\.log$/, ""),
        log,
        running: !log.includes("=== JOB EXIT"),
      }
    })
}
