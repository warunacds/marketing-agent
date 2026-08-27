"use client"

import { type ReactNode, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { runPipeline } from "@/lib/actions"
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
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export function CreateContentDialog({
  products,
  trigger,
}: {
  products: string[]
  trigger?: ReactNode
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [product, setProduct] = useState(products[0] ?? "")
  const [instructions, setInstructions] = useState("")
  const [model, setModel] = useState("")
  const [pending, startTransition] = useTransition()

  function start(pipeline: "content" | "report") {
    if (!product) return
    startTransition(async () => {
      const result = await runPipeline(pipeline, product, {
        model: model.trim() || undefined,
        instructions: instructions.trim() || undefined,
      })
      if (result.ok) {
        setOpen(false)
        toast.success(
          pipeline === "content"
            ? "The AI has started writing"
            : "The AI is preparing your report",
          { description: "This takes a few minutes. You can follow along on the Activity page." }
        )
        router.push(`/p/${product}/activity`)
        router.refresh()
      } else {
        toast.error("Could not start", { description: result.output.slice(0, 400) })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="lg">Create this week&apos;s content</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create this week&apos;s content</DialogTitle>
          <DialogDescription>
            The AI will draft a blog post, social posts, and a newsletter, then put them here for
            your review. Nothing is published until you approve it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="cc-product" className="text-sm font-medium">
              Product
            </label>
            <Select
              id="cc-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
            >
              {products.length === 0 && <option value="">No products set up yet</option>}
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="cc-instructions" className="text-sm font-medium">
              Tell the AI what you want this week (optional)
            </label>
            <Textarea
              id="cc-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="e.g. Write about SSL certificate expiry; mention the free checker tool"
              className="min-h-24"
            />
          </div>
          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-sm text-muted-foreground">Advanced</summary>
            <div className="mt-3 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="cc-model" className="text-sm font-medium">
                  AI model override
                </label>
                <Input
                  id="cc-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Leave empty for the default"
                />
              </div>
              <div className="space-y-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || !product}
                  onClick={() => start("report")}
                >
                  Create a performance report instead
                </Button>
                <p className="text-xs text-muted-foreground">
                  Summarises how your published content is doing.
                </p>
              </div>
            </div>
          </details>
        </div>
        <DialogFooter>
          <Button disabled={pending || !product} onClick={() => start("content")}>
            {pending ? "Starting…" : "Start creating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
