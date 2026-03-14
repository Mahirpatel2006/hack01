import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { rows } = await queryRows(`
      SELECT a.id, a.quantity, a.reason, a.created_at,
             p.id AS product_id, p.name AS product_name, p.sku,
             w.id AS warehouse_id, w.name AS warehouse_name,
             COALESCE(s.quantity, 0) AS current_stock
      FROM adjustments a
      JOIN products p  ON p.id = a.product_id
      JOIN warehouses w ON w.id = a.warehouse_id
      LEFT JOIN stocks s ON s.product_id = a.product_id AND s.warehouse_id = a.warehouse_id
      ORDER BY a.created_at DESC
    `)

    const adjustments = rows.map((r: Record<string,unknown>) => ({
      ...r,
      product:   { id: r.product_id,   name: r.product_name, sku: r.sku },
      warehouse: { id: r.warehouse_id, name: r.warehouse_name },
    }))
    return NextResponse.json({ adjustments })
  } catch (err) {
    console.error('[adjustment GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { productId, warehouseId, quantity, reason } = await req.json()
    if (!productId || !warehouseId || quantity === undefined) {
      return NextResponse.json({ error: 'Product, warehouse, and quantity are required.' }, { status: 400 })
    }

    const newQty = Number(quantity)
    if (newQty < 0) return NextResponse.json({ error: 'Quantity must be 0 or more.' }, { status: 400 })

    await withTransaction(async (client) => {
      const { rows: stkRows } = await client.query(
        `SELECT quantity FROM stocks WHERE product_id = $1 AND warehouse_id = $2`,
        [Number(productId), Number(warehouseId)]
      )
      const oldQty = stkRows[0]?.quantity ?? 0
      const delta  = newQty - oldQty

      await client.query(
        `INSERT INTO stocks (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)
         ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = $3`,
        [Number(productId), Number(warehouseId), newQty]
      )

      const { rows: adjRows } = await client.query(
        `INSERT INTO adjustments (product_id, warehouse_id, quantity, reason) VALUES ($1, $2, $3, $4) RETURNING *`,
        [Number(productId), Number(warehouseId), newQty, reason?.trim() ?? null]
      )

      await client.query(
        `INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta)
         VALUES ('adjustment', $1, $2, $3, $4)`,
        [adjRows[0].id, Number(productId), Number(warehouseId), delta]
      )
    })

    return NextResponse.json({ message: 'Stock adjusted.' }, { status: 201 })
  } catch (err) {
    console.error('[adjustment POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
