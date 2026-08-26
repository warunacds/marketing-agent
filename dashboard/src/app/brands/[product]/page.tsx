import Link from "next/link"
import { notFound } from "next/navigation"
import { BrandEditor } from "@/components/brand-editor"
import { Badge } from "@/components/ui/badge"
import { getBrandFile, getBrandFiles } from "@/lib/state"

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
  const files = getBrandFiles(product)
  if (files.length === 0) notFound()
  const active = file && files.includes(file) ? file : files[0]
  const content = getBrandFile(product, active)
  if (content === null) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{product}</h1>
        <p className="text-sm text-muted-foreground">brands/{product}/{active}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => (
          <Link key={f} href={`/brands/${product}?file=${encodeURIComponent(f)}`}>
            <Badge variant={f === active ? "default" : "outline"} className="hover:bg-accent">
              {f}
            </Badge>
          </Link>
        ))}
      </div>
      <BrandEditor key={`${product}/${active}`} product={product} file={active} initial={content} />
    </div>
  )
}
