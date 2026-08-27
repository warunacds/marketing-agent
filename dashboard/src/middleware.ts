import { NextResponse, type NextRequest } from "next/server"
import { AUTH_COOKIE, sha256Hex } from "@/lib/password"

export async function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD
  if (!password) return NextResponse.next() // no password configured — leave open (localhost only)

  const cookie = request.cookies.get(AUTH_COOKIE)?.value
  if (cookie && cookie === (await sha256Hex(password))) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.search = ""
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico).*)"],
}
