import { NextResponse, type NextRequest } from 'next/server'
import { generateOtp } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'
import { validateEmail, sanitize } from '@/lib/validation'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email: rawEmail } = body

    const ev = validateEmail(rawEmail)
    if (!ev.ok) return NextResponse.json({ error: ev.error }, { status: 400 })

    const email = sanitize(rawEmail).toLowerCase()

    // Check if user exists — but always return { success: true } to prevent enumeration
    const user = await queryOne('SELECT id FROM users WHERE LOWER(email) = $1', [email])

    if (!user) {
      // No enumeration — pretend we sent it
      return NextResponse.json({ success: true })
    }

    // Delete any previous unused OTPs for this email
    await query(
      'DELETE FROM otp_codes WHERE LOWER(email) = $1 AND used = FALSE',
      [email]
    )

    // Generate and store OTP
    const code = generateOtp()
    await query(
      'INSERT INTO otp_codes (email, code) VALUES ($1, $2)',
      [email, code]
    )

    // OTP is returned in response and displayed in UI (no email server)
    return NextResponse.json({ success: true, otp: code })

  } catch (err) {
    console.error('[otp/request]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
