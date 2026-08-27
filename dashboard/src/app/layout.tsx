import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { cookies } from "next/headers"
import Link from "next/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Toaster } from "@/components/ui/sonner"
import { logout } from "@/lib/auth"
import { AUTH_COOKIE } from "@/lib/password"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Marketing assistant",
  description: "Review, approve, and publish AI-drafted marketing content",
}

// Runs before hydration/first paint: stored choice wins, otherwise follow the
// OS preference. Must stay in sync with the toggle in theme-toggle.tsx.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`

const nav = [
  { href: "/", label: "Review" },
  { href: "/runs", label: "Activity" },
  { href: "/brands", label: "Product info" },
]

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = (await cookies()).has(AUTH_COOKIE)
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="mx-auto max-w-6xl px-4">
          <header className="flex items-center gap-6 border-b py-4">
            <Link href="/" className="font-semibold tracking-tight">
              Marketing assistant
            </Link>
            {authed && (
              <nav className="flex gap-4 text-sm text-muted-foreground">
                {nav.map((n) => (
                  <Link key={n.href} href={n.href} className="hover:text-foreground">
                    {n.label}
                  </Link>
                ))}
              </nav>
            )}
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              {authed && process.env.DASHBOARD_PASSWORD && (
                <form action={logout}>
                  <button className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                    Log out
                  </button>
                </form>
              )}
            </div>
          </header>
          <main className="py-6">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
