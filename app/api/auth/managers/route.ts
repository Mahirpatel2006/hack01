import { NextResponse, type NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { COOKIE_NAME } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const payload = await verifyToken(token)
  if (!payload || payload.role !== 'owner') {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const rows = await query<{ id: string; email: string; full_name: string; created_at: string }>(
    `SELECT id, email, full_name, created_at FROM users WHERE role = 'manager' ORDER BY created_at DESC`
  )

  return NextResponse.json({ managers: rows })
}
