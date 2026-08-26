"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveBrandFile } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function BrandEditor({
  product,
  file,
  initial,
}: {
  product: string
  file: string
  initial: string
}) {
  const [content, setContent] = useState(initial)
  const [pending, startTransition] = useTransition()
  const dirty = content !== initial

  return (
    <div className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="min-h-[28rem] font-mono text-sm leading-relaxed"
        spellCheck={false}
      />
      <Button
        disabled={pending || !dirty}
        onClick={() =>
          startTransition(async () => {
            try {
              const result = await saveBrandFile(product, file, content)
              toast.success("Saved", { description: result.output })
            } catch (e) {
              toast.error("Save failed", { description: String(e) })
            }
          })
        }
      >
        {pending ? "Saving…" : dirty ? "Save" : "Saved"}
      </Button>
    </div>
  )
}
