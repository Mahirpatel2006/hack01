import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'
import { logger } from '@/lib/logger'

interface DeliveryItemRow {
  id: number
  delivery_id: number
  product_id: number
  quantity: number
  warehouse_id: number
}

import { handleRouteError, Errors } from '@/lib/errors'

const DELIVERY_WITH_JOINS = `
  SELECT d.id, d.customer, d.status, d.created_at, d.updated_at,
         COALESCE(json_agg(json_build_object(
           'id',           di.id,
           'product_id',   di.product_id,
           'quantity',     di.quantity,
           'warehouse_id', di.warehouse_id,
           'product',      json_build_object('id', p.id, 'name', p.name, 'sku', p.sku),
           'warehouse',    json_build_object('id', w.id, 'name', w.name)
         )) FILTER (WHERE di.id IS NOT NULL), '[]') AS items
  FROM deliveries d
  LEFT JOIN delivery_items di ON di.delivery_id = d.id
  LEFT JOIN products p        ON p.id = di.product_id
  LEFT JOIN warehouses w      ON w.id = di.warehouse_id
`

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page   = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const limit  = Math.min(100, parseInt(searchParams.get('limit') ?? '25'))
    const offset = (page - 1) * limit

    const where  = status ? `WHERE d.status = $1` : ''
    const params = status ? [status] : []

    const { rows: countRows } = await queryRows<{ total: string }>(
      `SELECT COUNT(DISTINCT d.id) AS total FROM deliveries d ${where}`, params
    )
    const total = parseInt(countRows[0]?.total ?? '0')

    const dataParams = status ? [status, limit, offset] : [limit, offset]
    const iStart = status ? 2 : 1
    const { rows } = await queryRows(
      `${DELIVERY_WITH_JOINS} ${where} GROUP BY d.id ORDER BY d.created_at DESC
       LIMIT $${iStart} OFFSET $${iStart + 1}`,
      dataParams
    )

    return NextResponse.json({ deliveries: rows, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    return handleRouteError(err, 'delivery GET')
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { customer, items } = await req.json()
    if (!customer?.trim())    throw Errors.badRequest('Customer name is required.')
    if (!items?.length)       throw Errors.badRequest('At least one item is required.')

    for (const item of items) {
      if (!item.productId || !item.warehouseId)
        throw Errors.badRequest('Each item requires productId and warehouseId.')
      if (!Number(item.quantity) || Number(item.quantity) <= 0)
        throw Errors.badRequest('Each item must have a positive quantity.')
    }

    const delivery = await withTransaction(async (client) => {
      const { rows: [d] } = await client.query(
        `INSERT INTO deliveries (customer, status, created_by) VALUES ($1, 'draft', $2) RETURNING *`,
        [customer.trim(), session.sub]
      )
      for (const item of items) {
        await client.query(
          `INSERT INTO delivery_items (delivery_id, product_id, quantity, warehouse_id)
           VALUES ($1, $2, $3, $4)`,
          [d.id, Number(item.productId), Number(item.quantity), Number(item.warehouseId)]
        )
      }
      return d
    })

    logger.info('delivery POST', `Delivery #${delivery.id} created by ${session.sub}`)
    return NextResponse.json({ message: 'Delivery created.', delivery }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'delivery POST')
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { deliveryId, status } = await req.json()
    if (!deliveryId || status !== 'validated')
      throw Errors.badRequest('deliveryId and status=validated are required.')

    const { rows: [d] } = await queryRows(`SELECT * FROM deliveries WHERE id = $1`, [Number(deliveryId)])
    if (!d)                       throw Errors.notFound('Delivery not found.')
    if (d.status === 'validated') throw Errors.badRequest('Delivery is already validated.')

    const { rows: items } = await queryRows<DeliveryItemRow>(
      `SELECT * FROM delivery_items WHERE delivery_id = $1`, [Number(deliveryId)]
    )

    await withTransaction(async (client) => {
      for (const item of items) {
        const { rows: [stk] } = await client.query(
          `SELECT quantity FROM stocks WHERE product_id = $1 AND warehouse_id = $2 FOR UPDATE`,
          [item.product_id, item.warehouse_id]
        )
        if (!stk || (stk as { quantity: number }).quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id} in warehouse ${item.warehouse_id}.`)
        }
        await client.query(
          `UPDATE stocks SET quantity = quantity - $1 WHERE product_id = $2 AND warehouse_id = $3`,
          [item.quantity, item.product_id, item.warehouse_id]
        )
        await client.query(
          `INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta)
           VALUES ('delivery', $1, $2, $3, $4)`,
          [d.id as number, item.product_id, item.warehouse_id, -item.quantity]
        )
      }
      await client.query(`UPDATE deliveries SET status = 'validated' WHERE id = $1`, [d.id])
    })

    logger.info('delivery PATCH', `Delivery #${deliveryId} validated by ${session.sub}`)
    return NextResponse.json({ message: 'Delivery validated. Stock decremented.' })
  } catch (err) {
    return handleRouteError(err, 'delivery PATCH')
  }
}
