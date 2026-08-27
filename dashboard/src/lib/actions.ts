"use server"

// Write-side: every mutation goes through the FastAPI backend, so the
// dashboard, the API, and the terminal share one code path.
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { api, ApiError } from "./api"
import { APPROVER_COOKIE } from "./password"

export interface ActionResult {
  ok: boolean
  output: string
  /** Set when approve was blocked by a force-able fact-check conflict (HTTP 409). */
  needsForce?: boolean
  /** Conflict code from the API: factcheck_fail | factcheck_stale | revising | conflict. */
  code?: string
  /** Background job started by this action, when there is one. */
  jobId?: string
}

function failure(e: unknown): ActionResult {
  return { ok: false, output: e instanceof Error ? e.message : String(e) }
}

export async function approveItem(slug: string, force = false): Promise<ActionResult> {
  try {
    const store = await cookies()
    const approved_by = store.get(APPROVER_COOKIE)?.value.slice(0, 80) || undefined
    const { output } = await api<{ output: string }>(
      `/api/items/${encodeURIComponent(slug)}/approve`,
      { method: "POST", body: JSON.stringify({ force, approved_by }) }
    )
    revalidatePath("/", "layout")
    return { ok: true, output }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      // factcheck_fail / factcheck_stale can be overridden with force;
      // revising cannot.
      if (e.code === "factcheck_fail" || e.code === "factcheck_stale") {
        return { ok: false, needsForce: true, code: e.code, output: e.message }
      }
      return failure(e)
    }
    return failure(e)
  }
}

export async function saveItemFile(
  slug: string,
  name: string,
  content: string
): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/items/pending/${encodeURIComponent(slug)}/files/${encodeURIComponent(name)}`,
      { method: "PUT", body: JSON.stringify({ content }) }
    )
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function reviseItem(
  slug: string,
  feedback: string,
  model?: string
): Promise<ActionResult> {
  try {
    const { job_id } = await api<{ job_id: string }>(
      `/api/items/${encodeURIComponent(slug)}/revise`,
      { method: "POST", body: JSON.stringify({ feedback, model: model || undefined }) }
    )
    return { ok: true, output: `Started (job ${job_id})` }
  } catch (e) {
    return failure(e)
  }
}

export async function factcheckItem(slug: string): Promise<ActionResult> {
  try {
    const { job_id } = await api<{ job_id: string }>(
      `/api/items/${encodeURIComponent(slug)}/factcheck`,
      { method: "POST", body: JSON.stringify({}) }
    )
    return { ok: true, output: `Started (job ${job_id})` }
  } catch (e) {
    return failure(e)
  }
}

export async function saveSchedule(
  product: string,
  schedule: {
    enabled: boolean
    day: string
    hour: number
    instructions: string
    // Always sent together: the API defaults omitted report fields, so a
    // partial body would silently reset them.
    report_enabled: boolean
    report_day: string
    report_hour: number
  }
): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/schedule/${encodeURIComponent(product)}`,
      { method: "PUT", body: JSON.stringify(schedule) }
    )
    revalidatePath("/brands", "layout")
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function saveChannels(
  product: string,
  channels: Record<string, Record<string, unknown>>
): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/channels/${encodeURIComponent(product)}`,
      { method: "PUT", body: JSON.stringify({ channels }) }
    )
    revalidatePath("/brands", "layout")
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function testChannel(product: string, channel: string): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/channels/${encodeURIComponent(product)}/test`,
      { method: "POST", body: JSON.stringify({ channel }) }
    )
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function resolveTodo(
  product: string,
  file: string,
  todo: string,
  answer: string
): Promise<ActionResult> {
  try {
    const { output, todos_remaining_in_file } = await api<{
      output: string
      todos_remaining_in_file: number
    }>(`/api/brands/${encodeURIComponent(product)}/todos/resolve`, {
      method: "POST",
      body: JSON.stringify({ file, todo, answer }),
    })
    revalidatePath("/brands", "layout")
    const left = todos_remaining_in_file
    return {
      ok: true,
      output: `${output} — ${left === 0 ? "no" : left} question${left === 1 ? "" : "s"} left in this file`,
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      return { ok: false, code: "conflict", output: e.message }
    }
    return failure(e)
  }
}

export async function createProduct(name: string, description?: string): Promise<ActionResult> {
  try {
    const data = await api<{ product: string; output: string; job_id?: string }>("/api/products", {
      method: "POST",
      body: JSON.stringify({ name, description: description?.trim() || undefined }),
    })
    revalidatePath("/brands", "layout")
    return { ok: true, output: data.output, jobId: data.job_id }
  } catch (e) {
    return failure(e)
  }
}

/** Poll helper for background jobs started from a dialog. */
export async function getJobStatus(id: string): Promise<string | null> {
  try {
    const { status } = await api<{ status: string }>(`/api/jobs/${encodeURIComponent(id)}`)
    return status
  } catch {
    return null
  }
}

export async function saveSecret(name: string, value: string): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>("/api/secrets", {
      method: "PUT",
      body: JSON.stringify({ name, value }),
    })
    revalidatePath("/brands", "layout")
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function rejectItem(slug: string, reason: string): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/items/${encodeURIComponent(slug)}/reject`,
      { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }
    )
    revalidatePath("/", "layout")
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function publishItem(slug: string, channels?: string[]): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/items/${encodeURIComponent(slug)}/publish`,
      { method: "POST", body: JSON.stringify(channels?.length ? { channels } : {}) }
    )
    // No revalidatePath here: any revalidation makes Next re-render the
    // current route inside the action response, and once the item moves to
    // published/ that re-render is a 404 that wipes the dialog showing the
    // publish output. Every page is force-dynamic + no-store, and the dialog
    // calls router.refresh() when it closes.
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}

export async function runPipeline(
  pipeline: "content" | "report",
  product: string,
  options?: { model?: string; instructions?: string }
): Promise<ActionResult> {
  try {
    const { job_id } = await api<{ job_id: string }>("/api/pipelines", {
      method: "POST",
      body: JSON.stringify({
        pipeline,
        product,
        model: options?.model || undefined,
        instructions: options?.instructions || undefined,
      }),
    })
    revalidatePath("/runs")
    return { ok: true, output: `Started (job ${job_id})` }
  } catch (e) {
    return failure(e)
  }
}

export async function saveBrandFile(
  product: string,
  file: string,
  content: string
): Promise<ActionResult> {
  try {
    const { output } = await api<{ output: string }>(
      `/api/brands/${encodeURIComponent(product)}/${encodeURIComponent(file)}`,
      { method: "PUT", body: JSON.stringify({ content }) }
    )
    revalidatePath("/brands", "layout")
    return { ok: true, output }
  } catch (e) {
    return failure(e)
  }
}
