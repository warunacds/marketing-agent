import Link from "next/link"
import { notFound } from "next/navigation"
import { BrandEditor } from "@/components/brand-editor"
import { Badge } from "@/components/ui/badge"
import { brandFileLabel } from "@/lib/format"
import { getBrand } from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function BrandPage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>
  searchParams: Promise<{ file?: string }>
}) {
  const { product } = await params
  const { file } = await searchParams
  const brand = await getBrand(product)
  if (!brand || brand.files.length === 0) notFound()

  const names = brand.files.map((f) => f.name)
  const activeName = file && names.includes(file) ? file : names[0]
  const active = brand.files.find((f) => f.name === activeName)
  if (!active) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{product}</h1>
        <p className="text-sm text-muted-foreground">
          The AI reads these notes before writing anything — what you change here shapes every
          future draft.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {names.map((f) => (
          <Link key={f} href={`/brands/${product}?file=${encodeURIComponent(f)}`}>
            <Badge variant={f === activeName ? "default" : "outline"} className="hover:bg-accent">
              {brandFileLabel(f)}
            </Badge>
          </Link>
        ))}
      </div>
      <p className="font-mono text-xs text-muted-foreground">
        brands/{product}/{activeName}
      </p>
      <BrandEditor
        key={`${product}/${activeName}`}
        product={product}
        file={activeName}
        initial={active.content}
      />
    </div>
  )
}
