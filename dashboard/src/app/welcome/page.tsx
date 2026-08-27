import { redirect } from "next/navigation"
import { AddProductDialog } from "@/components/add-product-dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { getProducts } from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function WelcomePage() {
  const products = await getProducts()
  if (products.length > 0) redirect(`/p/${products[0]}`)

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl justify-end px-4 py-3">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
          Let&apos;s set up your first product
        </h1>
        <p className="text-muted-foreground">
          Tell the assistant what you&apos;re marketing. It learns about your product and starts
          drafting content for you to review — nothing goes out until you approve it.
        </p>
        <AddProductDialog
          trigger={
            <Button size="lg" className="mt-2">
              Add your first product
            </Button>
          }
        />
      </div>
    </div>
  )
}
