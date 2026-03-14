import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const rows = await query(`SELECT id, name FROM categories ORDER BY name ASC`)
    return NextResponse.json({ categories: rows })
  } catch (err) {
    console.error('[category GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Category name is required.' }, { status: 400 })

    const rows = await query(
      `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING *`,
      [name.trim()]
    )
    return NextResponse.json({ category: rows[0] }, { status: 201 })
  } catch (err) {
    console.error('[category POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
