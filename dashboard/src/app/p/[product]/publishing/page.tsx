import { notFound } from "next/navigation"
import { PublishingCard } from "@/components/publishing-card"
import { ScheduleCard } from "@/components/schedule-card"
import {
  getBrowserSessions,
  getChannels,
  getProducts,
  getSchedules,
  getSecrets,
  type Schedule,
} from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function PublishingPage({
  params,
}: {
  params: Promise<{ product: string }>
}) {
  const { product } = await params
  const products = await getProducts()
  if (!products.includes(product)) notFound()

  const [channels, schedules, secrets, browserSessions] = await Promise.all([
    getChannels(product),
    getSchedules(),
    getSecrets(["TYPEFULLY_API_KEY", "RESEND_API_KEY"]),
    getBrowserSessions(),
  ])

  const schedule: Schedule = schedules.find((s) => s.product === product) ?? {
    product,
    enabled: false,
    day: "monday",
    hour: 9,
    instructions: "",
    report_enabled: false,
    report_day: "friday",
    report_hour: 17,
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Publishing</h1>
        <p className="text-sm text-muted-foreground">
          Choose where each piece goes, and set a schedule if you want the AI to run on its own.
        </p>
      </div>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-ink">Where content goes</h2>
          <p className="text-sm text-muted-foreground">
            Set up each destination once — approved content goes out when you press Publish. Send a
            test before you rely on one.
          </p>
        </div>
        <PublishingCard
          product={product}
          channels={channels}
          secrets={secrets}
          browserSessions={browserSessions}
        />
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold text-ink">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Let the AI draft on a weekly rhythm, or leave this off and create content whenever you
            want. Drafts always wait for your approval.
          </p>
        </div>
        <ScheduleCard schedule={schedule} />
      </section>
    </div>
  )
}
