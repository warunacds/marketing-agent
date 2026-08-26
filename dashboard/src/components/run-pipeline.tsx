"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { runPipeline } from "@/lib/actions"
import { Button } from "@/components/ui/button"

export function RunPipeline({ products }: { products: string[] }) {
  const router = useRouter()
  const [product, setProduct] = useState(products[0] ?? "")
  const [pending, startTransition] = useTransition()

  function start(pipeline: "content" | "report") {
    if (!product) {
      toast.error("No products yet", {
        description: "Create one: cp -r brands/_template brands/<product>",
      })
      return
    }
    startTransition(async () => {
      const result = await runPipeline(pipeline, product)
      toast.success(`${pipeline} pipeline started`, { description: result.output })
      router.push("/runs")
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={product}
        onChange={(e) => setProduct(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        {products.length === 0 && <option value="">no products</option>}
        {products.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <Button size="sm" disabled={pending} onClick={() => start("content")}>
        Run content
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => start("report")}>
        Run report
      </Button>
    </div>
  )
}
