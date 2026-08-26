import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getBrandFiles, getProducts } from "@/lib/state"

export const dynamic = "force-dynamic"

export default function BrandsPage() {
  const products = getProducts()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Brand brains</h1>
        <p className="text-sm text-muted-foreground">
          One folder per product — this is where output quality comes from. Click a file to edit.
        </p>
      </div>
      {products.length === 0 && (
        <p className="text-sm text-muted-foreground/70">
          No products yet. Create one: <code>cp -r brands/_template brands/&lt;product&gt;</code>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {products.map((product) => (
          <Card key={product}>
            <CardHeader>
              <CardTitle>{product}</CardTitle>
              <CardDescription>brands/{product}/</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {getBrandFiles(product).map((file) => (
                <Link key={file} href={`/brands/${product}?file=${encodeURIComponent(file)}`}>
                  <Badge variant="outline" className="hover:bg-accent">
                    {file}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
