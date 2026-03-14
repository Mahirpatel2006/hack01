import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager' && session.role !== 'owner') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { name, warehouseId } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Location name is required.' }, { status: 400 })
    if (!warehouseId) return NextResponse.json({ error: 'Warehouse ID is required.' }, { status: 400 })

    const location = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO locations (name, warehouse_id) VALUES ($1, $2) RETURNING *`, 
        [name.trim(), Number(warehouseId)]
      )
      return rows[0]
    })
    return NextResponse.json({ location }, { status: 201 })
  } catch (err) {
    console.error('[location POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager' && session.role !== 'owner') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Location ID is required.' }, { status: 400 })

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM locations WHERE id = $1`, [Number(id)])
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[location DELETE]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
