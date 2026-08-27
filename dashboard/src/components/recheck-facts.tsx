"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { factcheckItem } from "@/lib/actions"
import { Button } from "@/components/ui/button"

export function RecheckFacts({ slug, running }: { slug: string; running: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  if (running) {
    return <span className="text-sm text-muted-foreground">Checking facts…</span>
  }

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await factcheckItem(slug)
          if (result.ok) {
            toast.success("Checking facts", {
              description: "Takes a minute or two — this page updates on its own.",
            })
            router.refresh()
          } else {
            toast.error("Could not start the fact-check", {
              description: result.output.slice(0, 400),
            })
          }
        })
      }
    >
      Re-check facts
    </Button>
  )
}
