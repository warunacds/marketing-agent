"use client"

import { type ReactNode, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createProduct, getJobStatus } from "@/lib/actions"
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

const NAME_RE = /^[a-z0-9][a-z0-9-]{1,40}$/

export function AddProductDialog({ trigger }: { trigger?: ReactNode }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [createdName, setCreatedName] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Poll the brandgen job while the dialog shows the drafting state.
  useEffect(() => {
    if (!jobId) return
    const timer = setInterval(async () => {
      const status = await getJobStatus(jobId)
      if (!status || status === "running") return
      clearInterval(timer)
      setJobId(null)
      setOpen(false)
      if (status === "done") {
        toast.success("Draft ready", {
          description:
            "The AI drafted the product info. Answer the Open questions to confirm its guesses.",
        })
      } else {
        toast.error("Drafting didn't finish", {
          description: "The product was created from the template. See Activity for details.",
        })
      }
      if (createdName) router.push(`/p/${createdName}`)
      router.refresh()
    }, 3000)
    return () => clearInterval(timer)
  }, [jobId, createdName, router])

  const nameValid = NAME_RE.test(name)

  function create() {
    startTransition(async () => {
      const result = await createProduct(name, description)
      if (!result.ok) {
        toast.error("Could not add the product", { description: result.output.slice(0, 400) })
        return
      }
      setCreatedName(name)
      router.refresh()
      if (result.jobId) {
        setJobId(result.jobId)
      } else {
        setOpen(false)
        toast.success(`${name} added`, {
          description: "It starts with template files — fill these in before the first run.",
        })
        router.push(`/p/${name}`)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (jobId) return // keep the dialog up while drafting
        setOpen(next)
        if (next) {
          setName("")
          setDescription("")
        }
      }}
    >
      <DialogTrigger asChild>{trigger ?? <Button>Add a product</Button>}</DialogTrigger>
      <DialogContent>
        {jobId ? (
          <DialogHeader>
            <DialogTitle>The AI is drafting the product info…</DialogTitle>
            <DialogDescription>
              This takes a minute or two. You&apos;ll get a draft plus a list of questions to
              confirm — answering them makes the AI more accurate.
            </DialogDescription>
          </DialogHeader>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add a product</DialogTitle>
              <DialogDescription>
                Give it a short name. Describe it and the AI drafts the product info for you —
                you&apos;ll get a draft plus a list of questions to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="ap-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="ap-name"
                  value={name}
                  onChange={(e) => setName(e.target.value.toLowerCase())}
                  placeholder="my-product"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens (2–41 characters).
                </p>
                {name.length > 0 && !nameValid && (
                  <p className="text-xs text-destructive">That name doesn&apos;t fit the rule yet.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label htmlFor="ap-description" className="text-sm font-medium">
                  Describe your product{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional — the AI drafts the product info from this)
                  </span>
                </label>
                <Textarea
                  id="ap-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. A tool that monitors domains, DNS and SSL certificates for small teams"
                  className="min-h-24"
                />
              </div>
            </div>
            <DialogFooter>
              <Button disabled={pending || !nameValid} onClick={create}>
                {pending ? "Adding…" : "Add product"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
