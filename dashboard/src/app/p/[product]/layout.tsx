import { AppShell } from "@/components/app-shell"
import { getProducts, getQueue } from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function ProductLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ product: string }>
}) {
  const { product } = await params
  const [products, queue] = await Promise.all([getProducts(), getQueue(product)])
  const pendingCount = queue.filter((i) => i.state === "pending").length

  return (
    <>
      <AppShell
        product={product}
        products={products}
        pendingCount={pendingCount}
        showLogout={Boolean(process.env.DASHBOARD_PASSWORD)}
      />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  )
}
