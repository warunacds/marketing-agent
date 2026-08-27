"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  cancelBrowserLogin,
  confirmBrowserLogin,
  loginBrowser,
  logoutBrowser,
  saveChannels,
  saveSecret,
  testChannel,
} from "@/lib/actions"
import { AutoRefresh } from "@/components/auto-refresh"
import { Button } from "@/components/ui/button"
import type { BrowserSession, ChannelConfig, Channels } from "@/lib/state"

const TYPE_LABELS: Record<string, string> = {
  manual: "Copy by hand",
  dir: "Save to a folder",
  webhook: "Send to a webhook",
  typefully: "Typefully — drafts your X thread",
  resend: "Resend — drafts your newsletter",
  browser_x: "Post to X in a browser",
  browser_reddit: "Post to Reddit in a browser",
  browser_linkedin: "Post to LinkedIn in a browser",
}

const SECRET_FOR: Record<string, { env: string; service: string }> = {
  typefully: { env: "TYPEFULLY_API_KEY", service: "Typefully" },
  resend: { env: "RESEND_API_KEY", service: "Resend" },
}

// Browser-driven channels: post through a real browser using a saved login.
const BROWSER_META: Record<string, { platform: string; description: string; testNote: string }> = {
  browser_x: {
    platform: "x",
    description:
      "Opens a real browser and posts your X thread using a login you save once — no password stored here.",
    testNote: "Opens a browser and composes a test thread — never posts.",
  },
  browser_reddit: {
    platform: "reddit",
    description:
      "Opens a real browser and submits a post to a subreddit using a login you save once — no password stored here.",
    testNote: "Opens a browser and fills a test post — never submits.",
  },
  browser_linkedin: {
    platform: "linkedin",
    description:
      "Opens a real browser and publishes a post to your LinkedIn feed using a login you save once — no password stored here.",
    testNote: "Opens a browser and composes a test post — never publishes.",
  },
}

const CHANNEL_DEFS: {
  id: keyof Channels
  label: string
  types: string[]
  multiple?: boolean
  intro?: string
}[] = [
  { id: "blog", label: "Blog post", types: ["manual", "dir", "webhook"] },
  {
    id: "social",
    label: "Social posts",
    types: ["manual", "typefully", "browser_x", "browser_reddit", "browser_linkedin", "webhook"],
    multiple: true,
    intro: "Post to as many places as you like — each posts on its own.",
  },
  { id: "newsletter", label: "Newsletter", types: ["manual", "resend", "webhook"] },
]

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

// ---- per-row state -----------------------------------------------------

interface RowState {
  id: number
  type: string
  initialType: string
  initialDry?: boolean
  path: string
  url: string
  headers: string
  audienceId: string
  from: string
  subreddit: string
  dryRun: boolean
  secretValue: string
  replacingKey: boolean
  keyJustSaved: boolean
}

function rowFromConfig(c: ChannelConfig, id: number): RowState {
  const type = c.type ?? "manual"
  const isBrowser = Boolean(BROWSER_META[type])
  return {
    id,
    type,
    initialType: type,
    initialDry: isBrowser ? Boolean(c.dry_run) : undefined,
    path: String(c.path ?? ""),
    url: String(c.url ?? ""),
    headers: c.headers && typeof c.headers === "object" ? JSON.stringify(c.headers) : "",
    audienceId: String(c.audience_id ?? ""),
    from: String(c.from ?? ""),
    subreddit: String(c.subreddit ?? ""),
    dryRun: isBrowser ? Boolean(c.dry_run) : true,
    secretValue: "",
    replacingKey: false,
    keyJustSaved: false,
  }
}

/** Returns an error message if the row is not ready to save, else null. */
function validateRow(row: RowState): string | null {
  if (row.type === "dir" && !row.path.trim()) return "Folder path is missing"
  if (row.type === "webhook") {
    if (!row.url.trim()) return "Webhook URL is missing"
    if (row.headers.trim()) {
      try {
        const p = JSON.parse(row.headers)
        if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error()
      } catch {
        return 'Webhook headers must be JSON, e.g. {"Authorization": "Bearer …"}'
      }
    }
  }
  if (row.type === "resend" && (!row.audienceId.trim() || !row.from.trim()))
    return "Resend needs an Audience ID and a From address"
  if (row.type === "browser_reddit" && !row.subreddit.trim())
    return "Pick a subreddit for the Reddit destination"
  return null
}

function configFromRow(row: RowState): Record<string, unknown> {
  const config: Record<string, unknown> = { type: row.type }
  if (row.type === "dir") config.path = row.path.trim()
  if (row.type === "webhook") {
    config.url = row.url.trim()
    if (row.headers.trim()) {
      try {
        config.headers = JSON.parse(row.headers)
      } catch {
        /* validated already */
      }
    }
  }
  const secret = SECRET_FOR[row.type]
  if (secret) config.api_key_env = secret.env
  if (row.type === "resend") {
    config.audience_id = row.audienceId.trim()
    config.from = row.from.trim()
  }
  if (BROWSER_META[row.type]) config.dry_run = row.dryRun
  if (row.type === "browser_reddit") config.subreddit = row.subreddit.trim()
  return config
}

// ---- per-platform browser login ----------------------------------------
// Login is keyed by platform, not by row: two rows on the same platform (e.g.
// two browser_x destinations) share one saved session, so they show one status.

function BrowserLoginControls({
  session,
  inProgress,
  busy,
  onLogin,
  onConfirm,
  onCancel,
  onLogout,
}: {
  session: BrowserSession
  inProgress: boolean
  busy: boolean
  onLogin: () => void
  onConfirm: () => void
  onCancel: () => void
  onLogout: () => void
}) {
  return (
    <div className="space-y-2">
      {inProgress ? (
        <div className="space-y-2 rounded-md border px-3 py-2">
          <p className="text-sm">
            A browser window opened — log in there, then come back and click below.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={onConfirm}>
              I&apos;ve finished logging in
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : session.logged_in ? (
        <p className="text-sm">
          <span className="text-success">✓ Logged into {session.label}</span>{" "}
          <button
            type="button"
            disabled={busy}
            onClick={onLogin}
            className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log in again
          </button>{" "}
          <button
            type="button"
            disabled={busy}
            onClick={onLogout}
            className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Log out
          </button>
        </p>
      ) : (
        <>
          <Button size="sm" disabled={busy} onClick={onLogin}>
            Log in to {session.label}
          </Button>
          <p className="text-xs text-muted-foreground">
            or run <code className="rounded bg-muted px-1 py-0.5">{session.login_command}</code> in
            your terminal
          </p>
        </>
      )}
      <p className="text-xs text-muted-foreground">
        Opens a browser on the machine running this app.
      </p>
    </div>
  )
}

// ---- one destination form ----------------------------------------------

function DestinationFields({
  product,
  channelId,
  row,
  types,
  secretsSet,
  browserSessions,
  update,
  onRemove,
  removeDisabled,
  onTest,
  testResult,
  busy,
  optimisticLogin,
  onLogin,
  onConfirmLogin,
  onCancelLogin,
  onLogoutBrowser,
}: {
  product: string
  channelId: string
  row: RowState
  types: string[]
  secretsSet: Record<string, boolean>
  browserSessions: BrowserSession[]
  update: (patch: Partial<RowState>) => void
  onRemove?: () => void
  removeDisabled?: boolean
  onTest: () => void
  testResult?: { ok: boolean; text: string }
  busy: boolean
  optimisticLogin: Record<string, boolean>
  onLogin: (platform: string) => void
  onConfirmLogin: (platform: string) => void
  onCancelLogin: (platform: string) => void
  onLogoutBrowser: (platform: string) => void
}) {
  const fid = (suffix: string) => `ch-${product}-${channelId}-${row.id}-${suffix}`
  const secret = SECRET_FOR[row.type]
  const keyOnServer = Boolean(secret && (secretsSet[secret.env] || row.keyJustSaved))
  const browser = BROWSER_META[row.type]

  function changeType(newType: string) {
    const patch: Partial<RowState> = { type: newType }
    if (BROWSER_META[newType]) {
      // Safe default: dry-run on, unless this exact type was the saved config.
      patch.dryRun = row.initialType === newType ? Boolean(row.initialDry) : true
    }
    update(patch)
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={fid("type")} className="block text-sm font-medium">
          Where this goes
        </label>
        <select
          id={fid("type")}
          value={row.type}
          onChange={(e) => changeType(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>

      {row.type === "dir" && (
        <div className="space-y-1.5">
          <label htmlFor={fid("path")} className="block text-sm font-medium">
            Folder path
          </label>
          <input
            id={fid("path")}
            value={row.path}
            onChange={(e) => update({ path: e.target.value })}
            placeholder="~/code/my-site/content/blog"
            className={inputClass}
          />
        </div>
      )}

      {row.type === "webhook" && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={fid("url")} className="block text-sm font-medium">
              Webhook URL
            </label>
            <input
              id={fid("url")}
              value={row.url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://your-site.com/api/posts"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={fid("headers")} className="block text-sm font-medium">
              Extra headers <span className="font-normal text-muted-foreground">(optional, JSON)</span>
            </label>
            <input
              id={fid("headers")}
              value={row.headers}
              onChange={(e) => update({ headers: e.target.value })}
              placeholder='{"Authorization": "Bearer …"}'
              className={`${inputClass} font-mono`}
            />
          </div>
        </>
      )}

      {row.type === "resend" && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={fid("aud")} className="block text-sm font-medium">
              Audience ID <span className="font-normal text-muted-foreground">(from Resend)</span>
            </label>
            <input
              id={fid("aud")}
              value={row.audienceId}
              onChange={(e) => update({ audienceId: e.target.value })}
              placeholder="aud_…"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={fid("from")} className="block text-sm font-medium">
              From address
            </label>
            <input
              id={fid("from")}
              value={row.from}
              onChange={(e) => update({ from: e.target.value })}
              placeholder="You <you@yourdomain.com>"
              className={inputClass}
            />
          </div>
        </>
      )}

      {browser && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{browser.description}</p>

          {row.type === "browser_reddit" && (
            <div className="space-y-1.5">
              <label htmlFor={fid("subreddit")} className="block text-sm font-medium">
                Subreddit
              </label>
              <div className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 text-sm focus-within:ring-2 focus-within:ring-ring/50">
                <span className="text-muted-foreground">r/</span>
                <input
                  id={fid("subreddit")}
                  value={row.subreddit}
                  onChange={(e) => update({ subreddit: e.target.value.replace(/^\/*(r\/)?/i, "") })}
                  placeholder="webdev"
                  className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The one community to post to. Posting the same thing to many subreddits is the
                fastest way to get banned — pick one that fits.
              </p>
            </div>
          )}

          {(() => {
            const session = browserSessions.find((s) => s.platform === browser.platform)
            if (!session) return null
            const inProgress =
              session.login_in_progress || Boolean(optimisticLogin[browser.platform])
            return (
              <BrowserLoginControls
                session={session}
                inProgress={inProgress}
                busy={busy}
                onLogin={() => onLogin(browser.platform)}
                onConfirm={() => onConfirmLogin(browser.platform)}
                onCancel={() => onCancelLogin(browser.platform)}
                onLogout={() => onLogoutBrowser(browser.platform)}
              />
            )
          })()}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={row.dryRun}
              onChange={(e) => update({ dryRun: e.target.checked })}
            />
            Dry run (compose but don&apos;t post)
          </label>
          <p className="text-xs text-muted-foreground">
            Leave this on until you&apos;ve watched it work. Turn off to post for real.
          </p>

          {row.type === "browser_reddit" && (
            <p className="text-xs text-muted-foreground">
              Reddit removes anything that reads like an ad. The AI writes a community-first post,
              but read it before you turn off dry run.
            </p>
          )}
        </div>
      )}

      {secret &&
        (keyOnServer && !row.replacingKey ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="text-success">✓ Key saved on the server</span>
            <button
              type="button"
              className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => update({ replacingKey: true })}
            >
              Replace key
            </button>
          </p>
        ) : (
          <div className="space-y-1">
            <input
              type="password"
              value={row.secretValue}
              onChange={(e) => update({ secretValue: e.target.value })}
              placeholder={`Paste your ${secret.service} API key`}
              aria-label={`${secret.service} API key`}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              Stored safely on the server — never shown again.
            </p>
          </div>
        ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={onTest}>
          Send test
        </Button>
        {onRemove && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || removeDisabled}
            onClick={onRemove}
          >
            Remove
          </Button>
        )}
        {secret && (
          <span className="text-xs text-muted-foreground">
            Testing creates a draft labeled TEST in {secret.service} — nothing is sent.
          </span>
        )}
        {browser && <span className="text-xs text-muted-foreground">{browser.testNote}</span>}
      </div>

      {testResult && (
        <div className="space-y-1">
          <p className={`text-sm ${testResult.ok ? "" : "text-destructive"}`}>
            {testResult.ok ? "Test result:" : "The test didn't work:"}
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
            {testResult.text}
          </pre>
        </div>
      )}
    </div>
  )
}

// ---- the card ----------------------------------------------------------

export function PublishingCard({
  product,
  channels,
  secrets,
  browserSessions,
}: {
  product: string
  channels: Channels
  secrets: Record<string, boolean>
  browserSessions: BrowserSession[]
}) {
  const router = useRouter()
  const [rowsByChannel, setRowsByChannel] = useState<Record<string, RowState[]>>(() => {
    const out: Record<string, RowState[]> = {}
    let id = 0
    for (const def of CHANNEL_DEFS) {
      const configs = channels[def.id]?.length ? channels[def.id] : [{ type: "manual" }]
      out[def.id] = configs.map((c) => rowFromConfig(c, id++))
    }
    return out
  })
  const [tests, setTests] = useState<Record<number, { ok: boolean; text: string }>>({})
  const [busy, setBusy] = useState(false)
  const [pending, startTransition] = useTransition()
  // Per-platform optimistic flag so the in-progress UI shows the instant Log in
  // is clicked, before the polled getBrowserSessions catches up.
  const [optimisticLogin, setOptimisticLogin] = useState<Record<string, boolean>>({})

  function beginLogin(platform: string) {
    startTransition(async () => {
      setOptimisticLogin((p) => ({ ...p, [platform]: true }))
      const result = await loginBrowser(platform)
      if (result.ok) {
        toast.success("Browser opened", {
          description: "Log in there, then come back and confirm.",
        })
        router.refresh()
      } else {
        setOptimisticLogin((p) => ({ ...p, [platform]: false }))
        toast.error("Could not open the browser", { description: result.output.slice(0, 400) })
      }
    })
  }

  function finishLogin(platform: string) {
    startTransition(async () => {
      const result = await confirmBrowserLogin(platform)
      setOptimisticLogin((p) => ({ ...p, [platform]: false }))
      if (result.ok) {
        toast.success("Logged in")
      } else {
        toast.error("Could not confirm the login", { description: result.output.slice(0, 400) })
      }
      router.refresh()
    })
  }

  function cancelLogin(platform: string) {
    startTransition(async () => {
      const result = await cancelBrowserLogin(platform)
      setOptimisticLogin((p) => ({ ...p, [platform]: false }))
      if (result.ok) {
        toast("Login cancelled")
      } else {
        toast.error("Could not cancel", { description: result.output.slice(0, 400) })
      }
      router.refresh()
    })
  }

  function logoutPlatform(platform: string) {
    startTransition(async () => {
      const result = await logoutBrowser(platform)
      if (result.ok) {
        toast("Logged out")
      } else {
        // 409 (a login window is open) and other errors both surface their message.
        toast.error("Could not log out", { description: result.output.slice(0, 400) })
      }
      router.refresh()
    })
  }

  // Poll browser-sessions while any login window is open so the state stays live.
  const loginInProgress =
    browserSessions.some((s) => s.login_in_progress) ||
    Object.values(optimisticLogin).some(Boolean)

  function updateRow(channelId: string, id: number, patch: Partial<RowState>) {
    setRowsByChannel((prev) => ({
      ...prev,
      [channelId]: prev[channelId].map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  }

  function addRow(channelId: string) {
    setRowsByChannel((prev) => {
      const maxId = Math.max(-1, ...Object.values(prev).flat().map((r) => r.id))
      return {
        ...prev,
        [channelId]: [...prev[channelId], rowFromConfig({ type: "manual" }, maxId + 1)],
      }
    })
  }

  function removeRow(channelId: string, id: number) {
    setRowsByChannel((prev) => ({
      ...prev,
      [channelId]: prev[channelId].filter((r) => r.id !== id),
    }))
    setTests((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  /** Validate every row, save any pasted keys, and build the full payload. */
  async function collectAll(): Promise<Record<string, Record<string, unknown>[]> | null> {
    const payload: Record<string, Record<string, unknown>[]> = {}
    for (const def of CHANNEL_DEFS) {
      const configs: Record<string, unknown>[] = []
      for (const row of rowsByChannel[def.id]) {
        const err = validateRow(row)
        if (err) {
          toast.error(err)
          return null
        }
        const secret = SECRET_FOR[row.type]
        if (secret) {
          if (row.secretValue.trim()) {
            const r = await saveSecret(secret.env, row.secretValue.trim())
            if (!r.ok) {
              toast.error("Could not save the key", { description: r.output.slice(0, 400) })
              return null
            }
            updateRow(def.id, row.id, { secretValue: "", replacingKey: false, keyJustSaved: true })
          } else if (!(secrets[secret.env] || row.keyJustSaved)) {
            toast.error(`Paste your ${secret.service} API key first`)
            return null
          }
        }
        configs.push(configFromRow(row))
      }
      payload[def.id] = configs
    }
    return payload
  }

  function save() {
    startTransition(async () => {
      setBusy(true)
      const payload = await collectAll()
      if (payload) {
        const result = await saveChannels(product, payload)
        if (result.ok) {
          toast.success("Saved", { description: "Publishing destinations updated." })
          router.refresh()
        } else {
          toast.error("Could not save", { description: result.output.slice(0, 400) })
        }
      }
      setBusy(false)
    })
  }

  function sendTest(channelId: string, index: number, rowId: number) {
    startTransition(async () => {
      setBusy(true)
      // Save first so the server list matches the index we're about to test.
      const payload = await collectAll()
      if (payload) {
        const saved = await saveChannels(product, payload)
        if (!saved.ok) {
          toast.error("Could not save before testing", { description: saved.output.slice(0, 400) })
        } else {
          const result = await testChannel(product, channelId, index)
          setTests((prev) => ({ ...prev, [rowId]: { ok: result.ok, text: result.output || "(no output)" } }))
          router.refresh()
        }
      }
      setBusy(false)
    })
  }

  const working = busy || pending

  return (
    <div className="space-y-4">
      <AutoRefresh active={loginInProgress} />
      {CHANNEL_DEFS.map((def) => {
        const rows = rowsByChannel[def.id]
        return (
          <div
            key={def.id}
            className="space-y-4 rounded-[var(--r)] border border-line bg-surface p-5 shadow-[var(--shadow)]"
          >
            <div className="space-y-0.5">
              <h3 className="font-display text-sm font-semibold text-ink">{def.label}</h3>
              {def.intro && <p className="text-xs text-muted-foreground">{def.intro}</p>}
            </div>
            {rows.map((row, i) => (
              <div
                key={row.id}
                className={
                  def.multiple ? "space-y-3 rounded-[var(--r-input)] border border-line p-3" : "space-y-3"
                }
              >
                <DestinationFields
                  product={product}
                  channelId={def.id}
                  row={row}
                  types={def.types}
                  secretsSet={secrets}
                  browserSessions={browserSessions}
                  update={(patch) => updateRow(def.id, row.id, patch)}
                  onRemove={def.multiple ? () => removeRow(def.id, row.id) : undefined}
                  removeDisabled={rows.length <= 1}
                  onTest={() => sendTest(def.id, i, row.id)}
                  testResult={tests[row.id]}
                  busy={working}
                  optimisticLogin={optimisticLogin}
                  onLogin={beginLogin}
                  onConfirmLogin={finishLogin}
                  onCancelLogin={cancelLogin}
                  onLogoutBrowser={logoutPlatform}
                />
              </div>
            ))}
            {def.multiple && (
              <Button variant="outline" size="sm" disabled={working} onClick={() => addRow(def.id)}>
                + Add another destination
              </Button>
            )}
          </div>
        )
      })}
      <Button disabled={working} onClick={save}>
        {working ? "Working…" : "Save destinations"}
      </Button>
    </div>
  )
}
