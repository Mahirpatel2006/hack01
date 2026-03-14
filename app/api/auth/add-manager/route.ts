import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken, hashPassword } from '@/lib/auth'
import { queryOne } from '@/lib/db'
import { validateEmail, validatePassword, validateFullName, sanitize } from '@/lib/validation'
import { COOKIE_NAME } from '@/lib/auth'
import { logger } from '@/lib/logger'

interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
}

export async function POST(request: NextRequest) {
  // Verify caller is owner
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden. Owner access required.' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { email: rawEmail, password, full_name: rawName } = body

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
       VALUES ($1, $2, $3, 'manager')
       RETURNING id, email, full_name, role, created_at`,
      [email, password_hash, full_name]
    )
    if (!user) throw new Error('Manager insert failed')

    logger.info('auth/add-manager', `Manager created: ${email}`)

    return NextResponse.json(
      { manager: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, created_at: user.created_at } },
      { status: 201 }
    )
  } catch (err) {
    logger.error('auth/add-manager', 'Error creating manager', err)
    return NextResponse.json({ error: 'Internal server error.', code: 'INTERNAL' }, { status: 500 })
  }
}
