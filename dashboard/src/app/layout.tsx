import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Marketing Agent",
  description: "Review queue, runs, and brand brains",
}

const nav = [
  { href: "/", label: "Queue" },
  { href: "/runs", label: "Runs" },
  { href: "/brands", label: "Brands" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <div className="mx-auto max-w-6xl px-4">
          <header className="flex items-center gap-6 border-b py-4">
            <Link href="/" className="font-semibold tracking-tight">
              marketing-agent
            </Link>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-foreground">
                  {n.label}
                </Link>
              ))}
            </nav>
          </header>
          <main className="py-6">{children}</main>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
