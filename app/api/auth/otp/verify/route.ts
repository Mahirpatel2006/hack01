import { NextResponse, type NextRequest } from 'next/server'
import { hashPassword, signToken, cookieOptions, COOKIE_NAME } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { validateEmail, validatePassword, validateOtp, sanitize } from '@/lib/validation'
import { jwtVerify } from 'jose'
import { checkRateLimit, OTP_LIMIT } from '@/lib/rateLimit'
import { logger } from '@/lib/logger'

interface OtpRow { id: string }
interface UserRow { id: string; email: string; full_name: string; role: string }

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? request.headers.get('x-real-ip') ?? 'unknown'

  try {
    const body = await request.json()
    const { email: rawEmail, otp: rawOtp, new_password } = body

    const ev = validateEmail(rawEmail)
    if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 })

    // Rate limit per email to prevent OTP brute-force
    const { allowed } = checkRateLimit(`otp-verify:${sanitize(rawEmail).toLowerCase()}`, OTP_LIMIT)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please request a new code.', code: 'RATE_LIMITED' },
        { status: 429 }
      )
    }

    const ov = validateOtp(rawOtp)
    if (!ov.ok) return NextResponse.json({ error: ov.error }, { status: 400 })

    const pv = validatePassword(new_password)
    if (!pv.ok) return NextResponse.json({ error: pv.error }, { status: 400 })

    const email = sanitize(rawEmail).toLowerCase()
    const otp   = sanitize(rawOtp)

    // Find valid OTP
    const otpRow = await queryOne<OtpRow>(
      `SELECT id FROM otp_codes
       WHERE LOWER(email) = $1 AND code = $2
         AND used = FALSE AND expires_at > NOW()`,
      [email, otp]
    )
    if (!otpRow) {
      return NextResponse.json(
        { error: 'Invalid or expired verification code.' },
        { status: 400 }
      )
    }

    // Mark OTP used
    await query('UPDATE otp_codes SET used = TRUE WHERE id = $1', [otpRow.id])

    // Update password
    const password_hash = await hashPassword(new_password)
    const user = await queryOne<UserRow>(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE LOWER(email) = $2 RETURNING id, email, full_name, role`,
      [password_hash, email]
    )
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    // Auto-login: sign token + set cookie
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

    logger.info('otp/verify', `Password reset for ${email}`)

    const response = NextResponse.json({ success: true })
    response.cookies.set(COOKIE_NAME, token, cookieOptions())
    return response

  } catch (err) {
    logger.error('otp/verify', 'OTP verify error', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
