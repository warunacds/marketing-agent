"use server"

// Write-side: every mutation shells out to the Python CLI so the dashboard
// and the terminal share one code path (approve/reject/publish semantics,
// manifests, notifications). Long-running pipeline runs are detached jobs
// whose output streams to runs/jobs/<id>.log.
import { execFile, spawn } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { revalidatePath } from "next/cache"
import { REPO_ROOT } from "./state"

const execFileAsync = promisify(execFile)
const PY = process.env.MARKETING_PYTHON ?? "python3"

const SLUG_RE = /^[a-z0-9][a-z0-9._-]*$/i

function assertSlug(value: string, label: string) {
  if (!SLUG_RE.test(value)) throw new Error(`invalid ${label}: ${value}`)
}

async function cli(args: string[]): Promise<{ ok: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execFileAsync(PY, ["-m", "marketing_agent", ...args], {
      cwd: REPO_ROOT,
      timeout: 120_000,
    })
    return { ok: true, output: [stdout, stderr].filter(Boolean).join("\n") }
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string }
    return { ok: false, output: err.stderr || err.stdout || err.message }
  }
}

export async function approveItem(slug: string) {
  assertSlug(slug, "item")
  const result = await cli(["approve", slug, "--yes"])
  revalidatePath("/", "layout")
  return result
}

export async function rejectItem(slug: string, reason: string) {
  assertSlug(slug, "item")
  const args = ["reject", slug]
  if (reason.trim()) args.push("--reason", reason.trim())
  const result = await cli(args)
  revalidatePath("/", "layout")
  return result
}

export async function publishItem(slug: string, channel?: string) {
  assertSlug(slug, "item")
  const args = ["publish", slug]
  if (channel) {
    assertSlug(channel, "channel")
    args.push("--channel", channel)
  }
  const result = await cli(args)
  revalidatePath("/", "layout")
  return result
}

export async function runPipeline(pipeline: "content" | "report", product: string, model?: string) {
  assertSlug(product, "product")
  if (model) assertSlug(model, "model")

  const jobsDir = path.join(REPO_ROOT, "runs", "jobs")
  fs.mkdirSync(jobsDir, { recursive: true })
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}-${pipeline}-${product}`
  const logFile = path.join(jobsDir, `${id}.log`)
  const out = fs.openSync(logFile, "a")

  const args = ["-m", "marketing_agent", pipeline, "--product", product]
  if (model) args.push("--model", model)

  const child = spawn(PY, args, {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ["ignore", out, out],
  })
  child.on("exit", (code) => {
    fs.appendFileSync(logFile, `\n=== JOB EXIT ${code} ===\n`)
  })
  child.unref()
  fs.closeSync(out)

  revalidatePath("/runs")
  return { ok: true, output: `started job ${id}` }
}

export async function saveBrandFile(product: string, file: string, content: string) {
  assertSlug(product, "product")
  if (!/^[a-z0-9._-]+\.(md|json)$/i.test(file)) throw new Error(`invalid file: ${file}`)
  const dir = path.join(REPO_ROOT, "brands", product)
  if (!fs.existsSync(dir)) throw new Error(`no such product: ${product}`)
  if (file === "channels.json") JSON.parse(content) // validate before writing
  fs.writeFileSync(path.join(dir, file), content)
  revalidatePath("/brands", "layout")
  return { ok: true, output: `saved brands/${product}/${file}` }
}
