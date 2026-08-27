import { cookies } from "next/headers"
import { login } from "@/lib/auth"
import { APPROVER_COOKIE } from "@/lib/password"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const dynamic = "force-dynamic"

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const savedName = (await cookies()).get(APPROVER_COOKIE)?.value
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
          <CardDescription>Enter the team password to open the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="space-y-3">
            <input
              type="password"
              name="password"
              required
              autoFocus
              placeholder="Team password"
              aria-label="Team password"
              className={inputClass}
            />
            <div className="space-y-1">
              <input
                type="text"
                name="name"
                maxLength={80}
                defaultValue={savedName ?? ""}
                placeholder="Your name (optional)"
                aria-label="Your name (optional)"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground">Shown next to what you approve.</p>
            </div>
            {error && (
              <p className="text-sm text-destructive">That password didn&apos;t match. Please try again.</p>
            )}
            <Button type="submit" className="w-full">
              Open dashboard
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
