import { cookies } from "next/headers"
import { login } from "@/lib/auth"
import { APPROVER_COOKIE } from "@/lib/password"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

export const dynamic = "force-dynamic"

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const savedName = (await cookies()).get(APPROVER_COOKIE)?.value
  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex max-w-6xl justify-end px-4 py-3">
        <ThemeToggle />
      </div>
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-display text-xl">Welcome</CardTitle>
            <CardDescription>Enter the team password to open the dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={login} className="space-y-3">
              <Input
                type="password"
                name="password"
                required
                autoFocus
                placeholder="Team password"
                aria-label="Team password"
              />
              <div className="space-y-1">
                <Input
                  type="text"
                  name="name"
                  maxLength={80}
                  defaultValue={savedName ?? ""}
                  placeholder="Your name (optional)"
                  aria-label="Your name (optional)"
                />
                <p className="text-xs text-muted-foreground">Shown next to what you approve.</p>
              </div>
              {error && (
                <p className="text-sm text-destructive">
                  That password didn&apos;t match. Please try again.
                </p>
              )}
              <Button type="submit" className="w-full">
                Open dashboard
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
