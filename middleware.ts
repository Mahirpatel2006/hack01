import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'

const AUTH_ROUTES   = ['/login', '/register', '/reset-password']
const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/auth/otp']

// Pages only managers can access
const MANAGER_ROUTES  = ['/product', '/warehouses']
const MANAGER_API     = ['/api/product', '/api/warehouse', '/api/category']

// All protected pages (require any authenticated user)
const PROTECTED_PAGES = [
  '/dashboard', '/product', '/warehouses',
  '/receipts', '/deliveries', '/transfers',
  '/adjustments', '/history', '/profile', '/access-denied',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token   = request.cookies.get(COOKIE_NAME)?.value ?? null
  const payload = token ? await verifyToken(token) : null

  const isAuthRoute      = AUTH_ROUTES.some(r => pathname.startsWith(r))
  const isProtectedPage  = PROTECTED_PAGES.some(r => pathname.startsWith(r))
  const isManagerPage    = MANAGER_ROUTES.some(r => pathname.startsWith(r))
  const isManagerApi     = MANAGER_API.some(r => pathname.startsWith(r))

  // Not authenticated → redirect to login from protected pages
  if (!payload && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Authenticated → skip auth pages (redirect to dashboard)
  if (payload && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Role check: manager-only pages for non-managers
  if (payload && isManagerPage && (payload as {role?:string}).role !== 'manager') {
    const url = request.nextUrl.clone()
    url.pathname = '/access-denied'
    return NextResponse.redirect(url)
  }

  // Role check: manager-only API endpoints
  if (isManagerApi && pathname.includes('add') || isManagerApi && pathname.includes('update')) {
    if (!payload || (payload as {role?:string}).role !== 'manager') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
