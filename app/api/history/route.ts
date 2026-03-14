import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const limit    = Math.min(100, parseInt(searchParams.get('limit') ?? '50'))
    const offset   = (page - 1) * limit
    const type     = searchParams.get('type')
    const productId= searchParams.get('productId')
    const warehouseId = searchParams.get('warehouseId')

    const conditions: string[] = []
    const params: (string | number)[] = []
    let i = 1

    if (type)        { conditions.push(`sm.move_type = $${i++}`);    params.push(type)           }
    if (productId)   { conditions.push(`sm.product_id = $${i++}`);   params.push(Number(productId))   }
    if (warehouseId) { conditions.push(`sm.warehouse_id = $${i++}`); params.push(Number(warehouseId)) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows: countRows } = await queryRows(
      `SELECT COUNT(*) AS total FROM stock_moves sm ${where}`, params
    )

    params.push(limit, offset)
    const { rows } = await queryRows(`
      SELECT sm.id, sm.move_type, sm.ref_id, sm.delta, sm.note, sm.created_at,
             p.id AS product_id, p.name AS product_name, p.sku,
             w.id AS warehouse_id, w.name AS warehouse_name
      FROM stock_moves sm
      JOIN products p   ON p.id = sm.product_id
      JOIN warehouses w ON w.id = sm.warehouse_id
      ${where}
      ORDER BY sm.created_at DESC
      LIMIT $${i++} OFFSET $${i++}
    `, params)

    const moves = rows.map(r => ({
      ...r,
      product:   { id: r.product_id,   name: r.product_name, sku: r.sku },
      warehouse: { id: r.warehouse_id, name: r.warehouse_name },
    }))

    return NextResponse.json({
      moves,
      total: parseInt(countRows[0].total),
      page,
      limit,
    })
  } catch (err) {
    console.error('[history GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
