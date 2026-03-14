import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryOne } from '@/lib/db'

interface UserRow {
  id: string
  email: string
  full_name: string
  role: string
  avatar_url: string | null
  created_at: string
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    // ── Owner shortcut — no DB row ─────────────────────────────────────────
    if (session.sub === 'owner' && session.role === 'owner') {
      return NextResponse.json({
        user: {
          id: 'owner',
          email: session.email,
          full_name: 'Owner',
          role: 'owner',
          avatar_url: null,
          created_at: new Date().toISOString(),
        },
      })
    }
    // ─────────────────────────────────────────────────────────────────────

    const user = await queryOne<UserRow>(
      'SELECT id, email, full_name, role, avatar_url, created_at FROM users WHERE id = $1',
      [session.sub]
    )
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

    return NextResponse.json({ user })
  } catch (err) {
    console.error('[me]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
