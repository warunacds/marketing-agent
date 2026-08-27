import { redirect } from "next/navigation"
import { getProducts } from "@/lib/state"

export const dynamic = "force-dynamic"

// Everything is scoped to a current product carried in the URL. Land the user
// on their first product, or on first-run setup when there are none.
export default async function RootPage() {
  const products = await getProducts()
  if (products.length === 0) redirect("/welcome")
  redirect(`/p/${products[0]}`)
}
