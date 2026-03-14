import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handleRouteError, Errors } from '@/lib/errors'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { rows } = await queryRows(`
      SELECT a.id, a.quantity, a.reason, a.created_at,
             p.id AS product_id, p.name AS product_name, p.sku,
             w.id AS warehouse_id, w.name AS warehouse_name,
             COALESCE(s.quantity, 0) AS current_stock
      FROM adjustments a
      JOIN products p   ON p.id = a.product_id
      JOIN warehouses w ON w.id = a.warehouse_id
      LEFT JOIN stocks s ON s.product_id = a.product_id AND s.warehouse_id = a.warehouse_id
      ORDER BY a.created_at DESC
      LIMIT 200
    `)

    const adjustments = rows.map((r: Record<string, unknown>) => ({
      ...r,
      product:   { id: r.product_id,   name: r.product_name, sku: r.sku },
      warehouse: { id: r.warehouse_id, name: r.warehouse_name },
    }))
    return NextResponse.json({ adjustments })
  } catch (err) {
    return handleRouteError(err, 'adjustment GET')
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { productId, warehouseId, quantity, reason } = await req.json()
    if (!productId)   throw Errors.badRequest('Product is required.')
    if (!warehouseId) throw Errors.badRequest('Warehouse is required.')
    if (quantity === undefined || quantity === null)
      throw Errors.badRequest('Quantity is required.')

    const newQty = Number(quantity)
    if (!Number.isInteger(newQty) || newQty < 0)
      throw Errors.badRequest('Quantity must be a non-negative integer.')

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
        `INSERT INTO adjustments (product_id, warehouse_id, quantity, reason, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [Number(productId), Number(warehouseId), newQty, reason?.trim() || null, session.sub]
      )

      await client.query(
        `INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta, note)
         VALUES ('adjustment', $1, $2, $3, $4, $5)`,
        [adjRows[0].id, Number(productId), Number(warehouseId), delta, reason?.trim() || null]
      )
    })

    logger.info('adjustment POST', `Adjustment on product ${productId} by ${session.sub}`)
    return NextResponse.json({ message: 'Stock adjusted.' }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'adjustment POST')
  }
}
