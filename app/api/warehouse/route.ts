import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { rows } = await queryRows(`
      SELECT w.id, w.name, w.created_at,
             COALESCE(json_agg(json_build_object('product_id', s.product_id, 'quantity', s.quantity))
               FILTER (WHERE s.id IS NOT NULL), '[]') AS stocks
      FROM warehouses w
      LEFT JOIN stocks s ON s.warehouse_id = w.id
      GROUP BY w.id
      ORDER BY w.name ASC
    `)
    return NextResponse.json({ warehouses: rows })
  } catch (err) {
    console.error('[warehouse GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Warehouse name is required.' }, { status: 400 })

    const warehouse = await withTransaction(async (client) => {
      const { rows } = await client.query(`INSERT INTO warehouses (name) VALUES ($1) RETURNING *`, [name.trim()])
      return rows[0]
    })
    return NextResponse.json({ warehouse }, { status: 201 })
  } catch (err) {
    console.error('[warehouse POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
