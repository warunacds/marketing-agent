import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon } from "lucide-react"
import { BrandEditor } from "@/components/brand-editor"
import { Badge } from "@/components/ui/badge"
import { brandFileLabel } from "@/lib/format"
import { getBrand } from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function KnowledgeFilePage({
  params,
}: {
  params: Promise<{ product: string; file: string }>
}) {
  const { product, file } = await params
  const brand = await getBrand(product)
  if (!brand || brand.files.length === 0) notFound()

  const names = brand.files.map((f) => f.name)
  const activeName = names.includes(file) ? file : names[0]
  const active = brand.files.find((f) => f.name === activeName)
  if (!active) notFound()
  // Notes only in the switcher — publishing config lives under Publishing.
  const noteNames = names.filter((n) => !n.endsWith(".json"))

  return (
    <div className="space-y-6">
      <Link
        href={`/p/${product}/knowledge`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-ink"
      >
        <ArrowLeftIcon className="size-4" />
        Back to what the AI knows
      </Link>
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {brandFileLabel(activeName)}
        </h1>
        <p className="text-sm text-muted-foreground">
          The AI reads these notes before writing anything — what you change here shapes every
          future draft.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {noteNames.map((f) => (
          <Link key={f} href={`/p/${product}/knowledge/${encodeURIComponent(f)}`}>
            <Badge
              variant={f === activeName ? "default" : "outline"}
              className={f === activeName ? "" : "hover:bg-surface-sunk"}
            >
              {brandFileLabel(f)}
            </Badge>
          </Link>
        ))}
      </div>
      <BrandEditor
        key={`${product}/${activeName}`}
        product={product}
        file={activeName}
        initial={active.content}
      />
    </div>
  )
}
