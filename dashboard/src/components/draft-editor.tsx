"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { saveItemFile } from "@/lib/actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

/**
 * Wraps a server-rendered draft (children) with an Edit toggle that swaps in
 * a raw-markdown textarea. Saving marks the item's fact-check stale.
 */
export function DraftEditor({
  slug,
  name,
  content,
  disabled,
  children,
}: {
  slug: string
  name: string
  content: string
  disabled?: boolean
  children: React.ReactNode
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(content)
  const [pending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      const result = await saveItemFile(slug, name, value)
      if (result.ok) {
        toast.success("Saved", {
          description: "Your edit hasn't been fact-checked — use “Re-check facts” when you're done.",
        })
        setEditing(false)
        router.refresh()
      } else {
        toast.error("Could not save", { description: result.output.slice(0, 400) })
      }
    })
  }

  if (!editing) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => {
              setValue(content)
              setEditing(true)
            }}
          >
            Edit
          </Button>
        </div>
        {children}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-h-[24rem] font-mono text-sm leading-relaxed"
        spellCheck={false}
        aria-label={`Edit ${name}`}
      />
      <div className="flex gap-2">
        <Button disabled={pending} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button variant="outline" disabled={pending} onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
