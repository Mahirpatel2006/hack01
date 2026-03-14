import { NextResponse, type NextRequest } from 'next/server'
import { hashPassword, signToken, cookieOptions, COOKIE_NAME } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { validateEmail, validatePassword, validateFullName, sanitize } from '@/lib/validation'
import { jwtVerify } from 'jose'
import { checkRateLimit, AUTH_LIMIT } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

// NOTE: Self-registration is always 'staff'. Managers must be assigned by an existing manager.
const SELF_REGISTER_ROLE = 'staff' as const

export async function POST(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const { allowed } = checkRateLimit(`register:${ip}`, AUTH_LIMIT)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many registration attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '900' } }
    )
  }

  try {
    const body = await request.json()
    const { email: rawEmail, password, full_name: rawName } = body

    // Ignore client-supplied role — all self-registrations are 'staff'
    const ev = validateEmail(rawEmail)
    if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 })

    const pv = validatePassword(password)
    if (!pv.ok) return NextResponse.json({ error: pv.error }, { status: 400 })

    const nv = validateFullName(rawName)
    if (!nv.ok) return NextResponse.json({ error: nv.error }, { status: 400 })

    const email     = sanitize(rawEmail).toLowerCase()
    const full_name = sanitize(rawName)

    const existing = await queryOne('SELECT id FROM users WHERE LOWER(email) = $1', [email])
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }

    const password_hash = await hashPassword(password)
    const user = await queryOne<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email, password_hash, full_name, SELF_REGISTER_ROLE]
    )
    if (!user) throw new Error('User insert failed')

    const token = await signToken({ sub: user.id, email: user.email, role: user.role })

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    const jti = payload.jti as string

    const ua = request.headers.get('user-agent') ?? null
    await query(
      `INSERT INTO sessions (user_id, jti, expires_at, ip_address, user_agent)
       VALUES ($1, $2, NOW() + INTERVAL '7 days', $3::inet, $4)`,
      [user.id, jti, ip !== 'unknown' ? ip : null, ua]
    )

    logger.info('auth/register', `New user registered: ${email}`)

    const response = NextResponse.json(
      { user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role } },
      { status: 201 }
    )
    response.cookies.set(COOKIE_NAME, token, cookieOptions())
    return response

  } catch (err) {
    logger.error('auth/register', 'Registration error', err)
    return NextResponse.json({ error: 'Internal server error.', code: 'INTERNAL' }, { status: 500 })
  }
}
