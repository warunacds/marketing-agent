import Link from "next/link"
import { Fragment } from "react"
import { AddProductDialog } from "@/components/add-product-dialog"
import { OpenQuestionsCard } from "@/components/open-questions-card"
import { PublishingCard } from "@/components/publishing-card"
import { ScheduleCard } from "@/components/schedule-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { brandFileLabel } from "@/lib/format"
import {
  getBrands,
  getBrowserSessions,
  getChannels,
  getSchedules,
  getSecrets,
  getTodos,
  type Schedule,
} from "@/lib/state"

export const dynamic = "force-dynamic"

export default async function ProductInfoPage() {
  const [brands, schedules, secrets, browserSessions] = await Promise.all([
    getBrands(),
    getSchedules(),
    getSecrets(["TYPEFULLY_API_KEY", "RESEND_API_KEY"]),
    getBrowserSessions(),
  ])
  const [channelsList, todosList] = await Promise.all([
    Promise.all(brands.map((b) => getChannels(b.product))),
    Promise.all(brands.map((b) => getTodos(b.product))),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Product info</h1>
          <p className="text-sm text-muted-foreground">
            This is what the AI knows about your product. Edit carefully — every marketing claim is
            checked against these files.
          </p>
        </div>
        <AddProductDialog />
      </div>
      {brands.length === 0 && (
        <p className="text-sm text-muted-foreground/70">No products set up yet.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {brands.map((brand, i) => {
          const schedule: Schedule = schedules.find((s) => s.product === brand.product) ?? {
            product: brand.product,
            enabled: false,
            day: "monday",
            hour: 9,
            instructions: "",
            report_enabled: false,
            report_day: "friday",
            report_hour: 17,
          }
          return (
            <Fragment key={brand.product}>
              <Card>
                <CardHeader>
                  <CardTitle>{brand.product}</CardTitle>
                  <CardDescription>Click a topic to read or edit it.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {brand.files.map((file) => (
                    <Link
                      key={file}
                      href={`/brands/${brand.product}?file=${encodeURIComponent(file)}`}
                    >
                      <Badge variant="outline" className="hover:bg-accent">
                        {brandFileLabel(file)}
                      </Badge>
                    </Link>
                  ))}
                </CardContent>
              </Card>
              <OpenQuestionsCard product={brand.product} todos={todosList[i]} />
              <PublishingCard
                product={brand.product}
                channels={channelsList[i]}
                secrets={secrets}
                browserSessions={browserSessions}
              />
              <ScheduleCard schedule={schedule} />
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
