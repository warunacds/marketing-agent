"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { approveItem, publishItem, rejectItem } from "@/lib/actions"
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

export function ItemActions({
  slug,
  state,
  factcheck,
}: {
  slug: string
  state: string
  factcheck?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [rejectOpen, setRejectOpen] = useState(false)
  const [reason, setReason] = useState("")

  function run(fn: () => Promise<{ ok: boolean; output: string }>, label: string) {
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(label, { description: result.output.slice(0, 400) })
        router.push("/")
        router.refresh()
      } else {
        toast.error(`${label} failed`, { description: result.output.slice(0, 400) })
      }
    })
  }

  if (state === "pending") {
    return (
      <div className="flex gap-2">
        <Button
          disabled={pending}
          onClick={() => {
            if (
              factcheck === "FAIL" &&
              !window.confirm("Fact-check FAILED for this item. Approve anyway?")
            )
              return
            run(() => approveItem(slug), "Approved")
          }}
        >
          Approve
        </Button>
        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" disabled={pending}>
              Reject
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {slug}</DialogTitle>
              <DialogDescription>
                The reason is recorded in the manifest and fed to the analyst.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Why is this being rejected? (optional)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  setRejectOpen(false)
                  run(() => rejectItem(slug, reason), "Rejected")
                }}
              >
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  if (state === "approved") {
    return (
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => run(() => publishItem(slug), "Published")}>
          Publish all channels
        </Button>
        {["blog", "social", "newsletter"].map((c) => (
          <Button
            key={c}
            variant="outline"
            disabled={pending}
            onClick={() => run(() => publishItem(slug, c), `Published ${c}`)}
          >
            {c}
          </Button>
        ))}
      </div>
    )
  }

  return null
}
