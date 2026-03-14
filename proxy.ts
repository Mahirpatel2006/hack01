import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken, COOKIE_NAME } from '@/lib/auth'
import { logger } from '@/lib/logger'

// ─── Route Classification ──────────────────────────────────────────────────────

const AUTH_ROUTES   = ['/login', '/register', '/reset-password']
const PUBLIC_ROUTES = ['/api/auth/login', '/api/auth/register', '/api/auth/otp']

/** Pages only managers can access */
const MANAGER_PAGES = ['/product', '/warehouses']
const MANAGER_APIS  = ['/api/product', '/api/warehouse', '/api/category']

/** Pages only owners can access */
const OWNER_PAGES = ['/owner']

/** All protected pages (require any authenticated user) */
const PROTECTED_PAGES = [
  '/dashboard', '/product', '/warehouses',
  '/receipts', '/deliveries', '/transfers',
  '/adjustments', '/history', '/profile', '/access-denied',
  ...OWNER_PAGES
]

// suppress unused-import warning
void PUBLIC_ROUTES
void OWNER_PAGES

// ─── Middleware ────────────────────────────────────────────────────────────────

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const start = Date.now()

  // Skip static assets early
  if (
    pathname.startsWith('/_next/static') ||
    pathname.startsWith('/_next/image') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token   = request.cookies.get(COOKIE_NAME)?.value ?? null
  const payload = token ? await verifyToken(token) : null

  const isAuthRoute     = AUTH_ROUTES.some(r => pathname.startsWith(r))
  const isProtectedPage = PROTECTED_PAGES.some(r => pathname.startsWith(r)) || OWNER_PAGES.some(r => pathname.startsWith(r))
  const isManagerPage   = MANAGER_PAGES.some(r => pathname.startsWith(r))
  const isManagerApi    = MANAGER_APIS.some(r => pathname.startsWith(r))
  const isOwnerPage     = OWNER_PAGES.some(r => pathname.startsWith(r))

  // ── Not authenticated → redirect to login ─────────────────────────────────
  if (!payload && isProtectedPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('from', pathname)
    logger.info('middleware', `Redirect unauthenticated → /login`, { pathname })
    return NextResponse.redirect(url)
  }

  // ── Authenticated → skip auth pages ───────────────────────────────────────
  if (payload && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // ── Role check: manager-only pages ────────────────────────────────────────
  if (payload && isManagerPage && payload.role !== 'manager' && payload.role !== 'owner') {
    const url = request.nextUrl.clone()
    url.pathname = '/access-denied'
    logger.warn('middleware', `Forbidden: ${payload.role} tried manager page ${pathname}`)
    return NextResponse.redirect(url)
  }

  // ── Role check: owner-only pages ──────────────────────────────────────────
  if (payload && isOwnerPage && payload.role !== 'owner') {
    const url = request.nextUrl.clone()
    url.pathname = '/access-denied'
    logger.warn('middleware', `Forbidden: ${payload.role} tried owner page ${pathname}`)
    return NextResponse.redirect(url)
  }

  // ── Role check: manager-only API mutations ────────────────────────────────
  const isMutation = pathname.includes('/add') || pathname.includes('/update') || pathname.includes('/delete')
  if (isManagerApi && isMutation) {
    if (!payload || (payload.role !== 'manager' && payload.role !== 'owner')) {
      logger.warn('middleware', `Forbidden: ${payload?.role} tried ${pathname}`)
      return NextResponse.json({ error: 'Forbidden.', code: 'FORBIDDEN' }, { status: 403 })
    }
  }

  // ── Add security headers ──────────────────────────────────────────────────
  const response = NextResponse.next()
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  logger.request(request.method, pathname, 200, Date.now() - start)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
