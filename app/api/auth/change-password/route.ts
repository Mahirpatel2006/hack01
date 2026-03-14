import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { verifyPassword, hashPassword } from '@/lib/auth'
import { queryOne, query } from '@/lib/db'

interface UserRow { id: string; password_hash: string }

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { currentPassword, newPassword } = await req.json()
    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both current and new password are required.' }, { status: 400 })
    }
    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
    }

    const user = await queryOne<UserRow>(`SELECT id, password_hash FROM users WHERE id = $1`, [session.sub])
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    const isValid = await verifyPassword(currentPassword, user.password_hash)
    if (!isValid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })

    const newHash = await hashPassword(newPassword)
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newHash, user.id])

    // Invalidate all sessions
    await query(`UPDATE sessions SET is_valid = false WHERE user_id = $1`, [user.id])

    return NextResponse.json({ message: 'Password changed. Please log in again.' })
  } catch (err) {
    console.error('[change-password]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
