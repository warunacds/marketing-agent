"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveChannels, saveSecret, testChannel } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { BrowserSession, ChannelConfig, Channels } from "@/lib/state"

const TYPE_LABELS: Record<string, string> = {
  manual: "Copy by hand",
  dir: "Save to a folder",
  webhook: "Send to a webhook",
  typefully: "Typefully — drafts your X thread",
  resend: "Resend — drafts your newsletter",
  browser_x: "Post to X in a browser",
  browser_reddit: "Post to Reddit in a browser",
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
}

const CHANNEL_DEFS: { id: keyof Channels; label: string; types: string[] }[] = [
  { id: "blog", label: "Blog post", types: ["manual", "dir", "webhook"] },
  {
    id: "social",
    label: "Social posts",
    types: ["manual", "typefully", "browser_x", "browser_reddit", "webhook"],
  },
  { id: "newsletter", label: "Newsletter", types: ["manual", "resend", "webhook"] },
]

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

function ChannelEditor({
  product,
  id,
  label,
  types,
  initial,
  secretsSet,
  browserSessions,
}: {
  product: string
  id: string
  label: string
  types: string[]
  initial: ChannelConfig
  secretsSet: Record<string, boolean>
  browserSessions: BrowserSession[]
}) {
  const router = useRouter()
  const [type, setType] = useState(initial.type ?? "manual")
  const [path, setPath] = useState(String(initial.path ?? ""))
  // Safe default: a freshly-picked browser channel composes but doesn't post.
  // Only an already-saved browser channel keeps its stored dry_run value.
  const [dryRun, setDryRun] = useState(
    initial.type === "browser_x" || initial.type === "browser_reddit"
      ? Boolean(initial.dry_run)
      : true
  )
  const [subreddit, setSubreddit] = useState(String(initial.subreddit ?? ""))
  const [url, setUrl] = useState(String(initial.url ?? ""))
  const [headers, setHeaders] = useState(
    initial.headers && typeof initial.headers === "object" ? JSON.stringify(initial.headers) : ""
  )
  const [audienceId, setAudienceId] = useState(String(initial.audience_id ?? ""))
  const [from, setFrom] = useState(String(initial.from ?? ""))
  const [secretValue, setSecretValue] = useState("")
  const [replacingKey, setReplacingKey] = useState(false)
  const [keyJustSaved, setKeyJustSaved] = useState(false)
  const [testOutput, setTestOutput] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const secret = SECRET_FOR[type]
  const keyOnServer = Boolean(secret && (secretsSet[secret.env] || keyJustSaved))

  /** Validates the form and saves key + channel config. Returns success. */
  async function doSave(): Promise<boolean> {
    if (type === "dir" && !path.trim()) {
      toast.error("Folder path is missing", { description: "Tell it which folder to save into." })
      return false
    }
    if (type === "webhook" && !url.trim()) {
      toast.error("Webhook URL is missing")
      return false
    }
    let parsedHeaders: Record<string, unknown> | undefined
    if (type === "webhook" && headers.trim()) {
      try {
        parsedHeaders = JSON.parse(headers)
        if (!parsedHeaders || typeof parsedHeaders !== "object" || Array.isArray(parsedHeaders)) {
          throw new Error("not an object")
        }
      } catch {
        toast.error("Headers must be JSON", { description: 'e.g. {"Authorization": "Bearer …"}' })
        return false
      }
    }
    if (type === "resend" && (!audienceId.trim() || !from.trim())) {
      toast.error("Resend needs an Audience ID and a From address")
      return false
    }
    if (type === "browser_reddit" && !subreddit.trim()) {
      toast.error("Pick a subreddit", { description: "Reddit posts need one community to go to." })
      return false
    }
    if (secret) {
      if (secretValue.trim()) {
        const keyResult = await saveSecret(secret.env, secretValue.trim())
        if (!keyResult.ok) {
          toast.error("Could not save the key", { description: keyResult.output.slice(0, 400) })
          return false
        }
        setSecretValue("")
        setReplacingKey(false)
        setKeyJustSaved(true)
      } else if (!keyOnServer) {
        toast.error(`Paste your ${secret.service} API key first`)
        return false
      }
    }

    const config: Record<string, unknown> = { type }
    if (type === "dir") config.path = path.trim()
    if (type === "webhook") {
      config.url = url.trim()
      if (parsedHeaders) config.headers = parsedHeaders
    }
    if (secret) config.api_key_env = secret.env
    if (type === "resend") {
      config.audience_id = audienceId.trim()
      config.from = from.trim()
    }
    if (type === "browser_x") config.dry_run = dryRun
    if (type === "browser_reddit") {
      config.subreddit = subreddit.trim()
      config.dry_run = dryRun
    }

    const result = await saveChannels(product, { [id]: config })
    if (!result.ok) {
      toast.error(`Could not save the ${label.toLowerCase()} channel`, {
        description: result.output.slice(0, 400),
      })
      return false
    }
    return true
  }

  function save() {
    startTransition(async () => {
      if (await doSave()) {
        toast.success("Saved", { description: `${label} now goes to: ${TYPE_LABELS[type] ?? type}` })
        router.refresh()
      }
    })
  }

  function sendTest() {
    startTransition(async () => {
      if (!(await doSave())) return
      const result = await testChannel(product, id)
      setTestOutput({ ok: result.ok, text: result.output || "(no output)" })
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor={`ch-${product}-${id}`} className="block text-sm font-medium">
          {label}
        </label>
        <select
          id={`ch-${product}-${id}`}
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setTestOutput(null)
          }}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {types.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
      </div>

      {type === "dir" && (
        <div className="space-y-1.5">
          <label htmlFor={`ch-${product}-${id}-path`} className="block text-sm font-medium">
            Folder path
          </label>
          <input
            id={`ch-${product}-${id}-path`}
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="~/code/my-site/content/blog"
            className={inputClass}
          />
        </div>
      )}

      {type === "webhook" && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={`ch-${product}-${id}-url`} className="block text-sm font-medium">
              Webhook URL
            </label>
            <input
              id={`ch-${product}-${id}-url`}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-site.com/api/posts"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`ch-${product}-${id}-headers`} className="block text-sm font-medium">
              Extra headers{" "}
              <span className="font-normal text-muted-foreground">(optional, JSON)</span>
            </label>
            <input
              id={`ch-${product}-${id}-headers`}
              value={headers}
              onChange={(e) => setHeaders(e.target.value)}
              placeholder='{"Authorization": "Bearer …"}'
              className={`${inputClass} font-mono`}
            />
          </div>
        </>
      )}

      {type === "resend" && (
        <>
          <div className="space-y-1.5">
            <label htmlFor={`ch-${product}-${id}-aud`} className="block text-sm font-medium">
              Audience ID <span className="font-normal text-muted-foreground">(from Resend)</span>
            </label>
            <input
              id={`ch-${product}-${id}-aud`}
              value={audienceId}
              onChange={(e) => setAudienceId(e.target.value)}
              placeholder="aud_…"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`ch-${product}-${id}-from`} className="block text-sm font-medium">
              From address
            </label>
            <input
              id={`ch-${product}-${id}-from`}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="You <you@yourdomain.com>"
              className={inputClass}
            />
          </div>
        </>
      )}

      {BROWSER_META[type] && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{BROWSER_META[type].description}</p>

          {type === "browser_reddit" && (
            <div className="space-y-1.5">
              <label htmlFor={`ch-${product}-${id}-subreddit`} className="block text-sm font-medium">
                Subreddit
              </label>
              <div className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 text-sm focus-within:ring-2 focus-within:ring-ring/50">
                <span className="text-muted-foreground">r/</span>
                <input
                  id={`ch-${product}-${id}-subreddit`}
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value.replace(/^\/*(r\/)?/i, ""))}
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
            const session = browserSessions.find((s) => s.platform === BROWSER_META[type].platform)
            if (!session) return null
            return session.logged_in ? (
              <p className="text-sm">
                <span className="text-success">✓ Logged into {session.label}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  (to re-login, run <code>{session.login_command}</code> again)
                </span>
              </p>
            ) : (
              <div className="space-y-1.5 rounded-md border px-3 py-2">
                <p className="text-sm">
                  One-time setup: run this in your terminal, then log in when the browser opens:
                </p>
                <pre className="overflow-x-auto rounded-md bg-muted p-2 text-xs">
                  <code>{session.login_command}</code>
                </pre>
                <p className="text-xs text-muted-foreground">
                  You only need to do this once — the login is remembered until the session
                  expires.
                </p>
              </div>
            )
          })()}

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
            />
            Dry run (compose but don&apos;t post)
          </label>
          <p className="text-xs text-muted-foreground">
            Leave this on until you&apos;ve watched it work. Turn off to post for real.
          </p>

          {type === "browser_reddit" && (
            <p className="text-xs text-muted-foreground">
              Reddit removes anything that reads like an ad. The AI writes a community-first post,
              but read it before you turn off dry run.
            </p>
          )}
        </div>
      )}

      {secret &&
        (keyOnServer && !replacingKey ? (
          <p className="flex items-center gap-2 text-sm">
            <span className="text-success">✓ Key saved on the server</span>
            <button
              type="button"
              className="cursor-pointer text-xs text-muted-foreground underline hover:text-foreground"
              onClick={() => setReplacingKey(true)}
            >
              Replace key
            </button>
          </p>
        ) : (
          <div className="space-y-1">
            <input
              type="password"
              value={secretValue}
              onChange={(e) => setSecretValue(e.target.value)}
              placeholder={`Paste your ${secret.service} API key`}
              aria-label={`${secret.service} API key`}
              className={inputClass}
            />
            <p className="text-xs text-muted-foreground">
              Stored safely on the server — never shown again.
            </p>
          </div>
        ))}

      <div className="flex items-center gap-2">
        <Button size="sm" disabled={pending} onClick={save}>
          {pending ? "Working…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={sendTest}>
          Send test
        </Button>
        {secret && (
          <span className="text-xs text-muted-foreground">
            Testing creates a draft labeled TEST in {secret.service} — nothing is sent.
          </span>
        )}
        {BROWSER_META[type] && (
          <span className="text-xs text-muted-foreground">{BROWSER_META[type].testNote}</span>
        )}
      </div>

      {testOutput && (
        <div className="space-y-1">
          <p className={`text-sm ${testOutput.ok ? "" : "text-destructive"}`}>
            {testOutput.ok ? "Test result:" : "The test didn't work:"}
          </p>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
            {testOutput.text}
          </pre>
        </div>
      )}
    </div>
  )
}

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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Publishing</CardTitle>
        <CardDescription>
          Where each piece of approved content goes when you press Publish.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {CHANNEL_DEFS.map((def, i) => (
          <div key={def.id} className="space-y-5">
            {i > 0 && <Separator />}
            <ChannelEditor
              product={product}
              id={def.id}
              label={def.label}
              types={def.types}
              initial={channels[def.id] ?? { type: "manual" }}
              secretsSet={secrets}
              browserSessions={browserSessions}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
