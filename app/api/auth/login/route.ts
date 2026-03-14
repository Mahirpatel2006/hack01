import { NextResponse, type NextRequest } from 'next/server'
import { verifyPassword, signToken, cookieOptions, COOKIE_NAME } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { validateEmail, validatePassword, sanitize } from '@/lib/validation'
import { jwtVerify } from 'jose'
import { checkRateLimit, AUTH_LIMIT } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'
import path from 'path'
import fs from 'fs'

// Fallback for loading env in dev if Next.js ignores .env.local due to wrong root
if (process.env.NODE_ENV === 'development') {
  try {
    const envPath = path.join(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8')
      content.split('\n').forEach(line => {
        const [key, ...val] = line.split('=')
        if (key && val.length > 0) {
          const value = val.join('=').trim().replace(/^["']|["']$/g, '')
          // Only set if not already set robustly
          if (!process.env[key.trim()] || process.env[key.trim()] === '') {
            process.env[key.trim()] = value
          }
        }
      })
    }
  } catch (e) { /* ignore */ }
  
  // Debug log to terminal to verify env is loaded
  logger.info('auth/login', `Owner env status: email=${!!process.env.OWNER_EMAIL}, pass=${!!process.env.OWNER_PASSWORD}`)
}


interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  password_hash: string
  is_active: boolean
}

const GENERIC_ERROR = 'Incorrect email or password.'

export async function POST(request: NextRequest) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip')
    ?? 'unknown'
  const { allowed, remaining } = checkRateLimit(`login:${ip}`, AUTH_LIMIT)
  if (!allowed) {
    logger.warn('auth/login', `Rate limited: ${ip}`)
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait 15 minutes.', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': '900', 'X-RateLimit-Remaining': String(remaining) } }
    )
  }

  try {
    const body = await request.json()
    const { email: rawEmail, password } = body

    const ev = validateEmail(rawEmail)
    if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 })

    const pv = validatePassword(password)
    if (!pv.ok) return NextResponse.json({ error: pv.error }, { status: 400 })

    const email = sanitize(rawEmail).toLowerCase()

    // ── Owner shortcut (hardcoded credentials, no DB row) ─────────────────
    const ownerEmail = (process.env.OWNER_EMAIL ?? '').toLowerCase()
    const ownerPass  = process.env.OWNER_PASSWORD ?? ''
    if (ownerEmail && email === ownerEmail && password === ownerPass) {
      const token = await signToken({ sub: 'owner', email: ownerEmail, role: 'owner' })
      logger.info('auth/login', `Owner logged in from ${ip}`)
      const response = NextResponse.json({
        user: { id: 'owner', email: ownerEmail, full_name: 'Owner', role: 'owner' },
      })
      response.cookies.set(COOKIE_NAME, token, cookieOptions())
      return response
    }
    // ─────────────────────────────────────────────────────────────────────

    const user = await queryOne<UserRow>(
      `SELECT id, email, full_name, role, password_hash, is_active
       FROM users WHERE LOWER(email) = $1`,
      [email]
    )

    if (!user || !user.is_active) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100))
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      await new Promise(r => setTimeout(r, 200 + Math.random() * 100))
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
    }

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

    logger.info('auth/login', `User logged in: ${email}`)

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    })
    response.cookies.set(COOKIE_NAME, token, cookieOptions())
    return response

  } catch (err) {
    logger.error('auth/login', 'Login error', err)
    return NextResponse.json({ error: 'Internal server error.', code: 'INTERNAL' }, { status: 500 })
  }
}
