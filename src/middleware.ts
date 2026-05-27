import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from './lib/auth'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get(COOKIE_NAME)?.value

  const isPublic =
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo.jpeg'

  if (isPublic) {
    if (pathname === '/login' && token && (await verifyToken(token))) {
      return NextResponse.redirect(new URL('/calendar', request.url))
    }
    return NextResponse.next()
  }

  if (!token || !(await verifyToken(token))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|logo.jpeg|favicon.ico).*)'],
}
