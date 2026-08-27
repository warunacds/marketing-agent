"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { approveItem, publishItem, rejectItem, reviseItem, type ActionResult } from "@/lib/actions"
import { asReceipts, type PublishReceipt } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"

const CHANNELS: { id: string; label: string; file: string }[] = [
  { id: "blog", label: "Blog post", file: "03-post.md" },
  { id: "social", label: "Social posts", file: "04-social.md" },
  { id: "newsletter", label: "Newsletter", file: "05-newsletter.md" },
]

export function ItemActions({
  slug,
  state,
  revising,
  published,
  files,
}: {
  slug: string
  state: string
  revising?: boolean
  published?: Record<string, PublishReceipt | PublishReceipt[]>
  files?: string[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [forceOpen, setForceOpen] = useState(false)
  const [forceCode, setForceCode] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [changesOpen, setChangesOpen] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [reviseModel, setReviseModel] = useState("")

  const channels = CHANNELS.filter((c) => !files || files.includes(c.file))
  // A channel counts as published only when every one of its destinations
  // succeeded — a partial/errored channel stays selectable to retry.
  const isPublished = (id: string) => {
    const receipts = asReceipts(published?.[id])
    return receipts.length > 0 && receipts.every((r) => r.status === "ok")
  }
  const [publishOpen, setPublishOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(() =>
    channels.filter((c) => !isPublished(c.id)).map((c) => c.id)
  )
  const [publishOutput, setPublishOutput] = useState<string | null>(null)

  function finish(result: ActionResult, successTitle: string, successDescription: string) {
    if (result.ok) {
      toast.success(successTitle, { description: successDescription })
      router.push("/")
      router.refresh()
    } else {
      toast.error("Something went wrong", { description: result.output.slice(0, 400) })
    }
  }

  function approve(force: boolean) {
    startTransition(async () => {
      const result = await approveItem(slug, force)
      if (!result.ok && result.needsForce) {
        setForceCode(result.code ?? null)
        setForceOpen(true)
        return
      }
      finish(result, "Approved", "It's now in the ready-to-publish list.")
    })
  }

  function reject() {
    startTransition(async () => {
      const result = await rejectItem(slug, reason)
      finish(result, "Rejected", "The draft was set aside — your reason is saved with it.")
    })
  }

  function requestChanges() {
    startTransition(async () => {
      const result = await reviseItem(slug, feedback.trim(), reviseModel.trim() || undefined)
      if (result.ok) {
        setChangesOpen(false)
        setFeedback("")
        toast.success("Sent to the AI", {
          description: "It's revising the drafts now — this page updates on its own.",
        })
        router.refresh()
      } else {
        toast.error("Could not send your feedback", { description: result.output.slice(0, 400) })
      }
    })
  }

  function publish() {
    startTransition(async () => {
      const result = await publishItem(slug, selected)
      if (result.ok) {
        setPublishOutput(result.output || "(no output)")
      } else {
        toast.error("Something went wrong", { description: result.output.slice(0, 400) })
      }
    })
  }

  if (state === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || revising} onClick={() => approve(false)}>
          Approve
        </Button>
        <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={pending || revising}>
              Request changes…
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request changes</DialogTitle>
              <DialogDescription>
                Tell the AI what to change. It rewrites the drafts, re-checks the facts, and puts
                the new version here for your review.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <label htmlFor="rc-feedback" className="text-sm font-medium">
                What should be different?
              </label>
              <Textarea
                id="rc-feedback"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="e.g. Make the intro shorter and mention the free SSL checker"
                className="min-h-24"
              />
            </div>
            <details className="rounded-md border px-3 py-2">
              <summary className="cursor-pointer text-sm text-muted-foreground">Advanced</summary>
              <div className="mt-3 space-y-1.5">
                <label htmlFor="rc-model" className="text-sm font-medium">
                  AI model override
                </label>
                <input
                  id="rc-model"
                  value={reviseModel}
                  onChange={(e) => setReviseModel(e.target.value)}
                  placeholder="Leave empty for the default"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
              </div>
            </details>
            <DialogFooter>
              <Button disabled={pending || !feedback.trim()} onClick={requestChanges}>
                {pending ? "Sending…" : "Send to the AI"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={pending || revising}>
              Reject…
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject this draft</DialogTitle>
              <DialogDescription>
                Optionally say why. This is saved so you remember why, and the AI learns from it
                next time.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="e.g. Tone is too pushy; the pricing section is out of date"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  setRejectOpen(false)
                  reject()
                }}
              >
                Reject draft
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={forceOpen} onOpenChange={setForceOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {forceCode === "factcheck_stale"
                  ? "Approve without a fresh fact-check?"
                  : "Approve without a clean fact-check?"}
              </DialogTitle>
              <DialogDescription>
                {forceCode === "factcheck_stale"
                  ? "These drafts were edited since the AI last checked the facts. Use “Re-check facts” first, or approve anyway if you're confident in the changes."
                  : "Some claims in this draft couldn't be verified against your product facts. If you've read the “Fact-check report” tab and you're happy with the content, you can approve it anyway."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForceOpen(false)}>
                Go back
              </Button>
              <Button
                disabled={pending}
                onClick={() => {
                  setForceOpen(false)
                  approve(true)
                }}
              >
                Approve anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (state === "approved") {
    return (
      <Dialog
        open={publishOpen}
        onOpenChange={(open) => {
          setPublishOpen(open)
          if (!open && publishOutput !== null) {
            // Closed after a successful publish — the item has moved on.
            router.push("/")
            router.refresh()
          }
        }}
      >
        <DialogTrigger asChild>
          <Button disabled={pending}>Publish…</Button>
        </DialogTrigger>
        <DialogContent>
          {publishOutput === null ? (
            <>
              <DialogHeader>
                <DialogTitle>Where should this go?</DialogTitle>
                <DialogDescription>
                  Pick the channels to publish to. Anything already published is skipped.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                {channels.map((c) => {
                  const done = isPublished(c.id)
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 text-sm ${done ? "text-muted-foreground" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        disabled={done || pending}
                        checked={!done && selected.includes(c.id)}
                        onChange={(e) =>
                          setSelected((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)
                          )
                        }
                      />
                      <span>{c.label}</span>
                      {done && <span className="text-xs text-success">✓ Published</span>}
                    </label>
                  )
                })}
              </div>
              <DialogFooter>
                <Button disabled={pending || selected.length === 0} onClick={publish}>
                  {pending ? "Publishing…" : "Publish selected"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Published</DialogTitle>
                <DialogDescription>
                  Here&apos;s what happened. If a channel says it was printed for manual publishing,
                  copy the text below and post it yourself.
                </DialogDescription>
              </DialogHeader>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
                {publishOutput}
              </pre>
              <DialogFooter>
                <Button
                  onClick={() => {
                    setPublishOpen(false)
                    router.push("/")
                    router.refresh()
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    )
  }

  return null
}
