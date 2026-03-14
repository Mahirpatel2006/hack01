import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handleRouteError, Errors } from '@/lib/errors'

interface ReceiptItemRow { id: number; product_id: number; quantity: number; received_qty: number }
interface ReceiptRow { id: number; status: string; warehouse_id: number; items: ReceiptItemRow[] | null }

const RECEIPT_WITH_JOINS = `
  SELECT r.id, r.supplier, r.status, r.receipt_date, r.created_at, r.updated_at,
         w.id AS warehouse_id, w.name AS warehouse_name,
         l.id AS location_id, l.name AS location_name,
         COALESCE(json_agg(json_build_object(
           'id',           ri.id,
           'product_id',   ri.product_id,
           'quantity',     ri.quantity,
           'received_qty', ri.received_qty,
           'product',      json_build_object('id', p.id, 'name', p.name, 'sku', p.sku)
         )) FILTER (WHERE ri.id IS NOT NULL), '[]') AS items
  FROM receipts r
  JOIN warehouses w        ON w.id = r.warehouse_id
  LEFT JOIN locations l    ON l.id = r.location_id
  LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
  LEFT JOIN products p       ON p.id = ri.product_id
`

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
    const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '25'))
    const offset = (page - 1) * limit
    const warehouseId = searchParams.get('warehouseId')

    const conditions: string[] = []
    const params: (string | number)[] = []
    let i = 1

    if (status) { conditions.push(`r.status = $${i++}`); params.push(status) }
    if (warehouseId) { conditions.push(`r.warehouse_id = $${i++}`); params.push(Number(warehouseId)) }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows: countRows } = await queryRows<{ total: string }>(
      `SELECT COUNT(DISTINCT r.id) AS total FROM receipts r ${where}`, [...params]
    )
    const total = parseInt(countRows[0]?.total ?? '0')

    const dataParams = [...params, limit, offset]
    const { rows } = await queryRows(
      `${RECEIPT_WITH_JOINS} ${where}
       GROUP BY r.id, w.id, l.id
       ORDER BY r.created_at DESC
       LIMIT $${i++} OFFSET $${i++}`,
      dataParams
    )

    const receipts = rows.map(r => ({
      ...r,
      warehouse: { id: r.warehouse_id, name: r.warehouse_name },
      location: r.location_id ? { id: r.location_id, name: r.location_name } : null
    }))

    return NextResponse.json({ receipts, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    return handleRouteError(err, 'receipt GET')
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { supplier, warehouseId, locationId, receiptDate, items } = await req.json()
    if (!supplier?.trim()) throw Errors.badRequest('Supplier name is required.')
    if (!warehouseId) throw Errors.badRequest('Warehouse is required.')
    if (!items?.length) throw Errors.badRequest('At least one item is required.')

    for (const item of items) {
      if (!item.productId) throw Errors.badRequest('Each item must have a productId.')
      if (!Number(item.quantity) || Number(item.quantity) <= 0)
        throw Errors.badRequest('Each item must have a positive quantity.')
    }

    const receipt = await withTransaction(async (client) => {
      const { rows: [r] } = await client.query(
        `INSERT INTO receipts (supplier, warehouse_id, location_id, receipt_date, status, created_by)
         VALUES ($1, $2, $3, $4, 'draft', $5) RETURNING *`,
        [supplier.trim(), Number(warehouseId), locationId ? Number(locationId) : null, receiptDate ?? new Date().toISOString().split('T')[0], session.sub]
      )
      for (const item of items) {
        await client.query(
          `INSERT INTO receipt_items (receipt_id, product_id, quantity, received_qty)
           VALUES ($1, $2, $3, 0)`,
          [r.id, Number(item.productId), Number(item.quantity)]
        )
      }
      return r
    })

    logger.info('receipt POST', `Receipt #${receipt.id} created by ${session.sub}`)
    return NextResponse.json({ message: 'Receipt created.', receipt }, { status: 201 })
  } catch (err) {
    return handleRouteError(err, 'receipt POST')
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { receiptId, status, items } = await req.json()
    if (!receiptId) throw Errors.badRequest('Receipt ID is required.')

    const VALID_STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled', 'validated']
    if (!VALID_STATUSES.includes(status))
      throw Errors.badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`)

    const { rows: [receipt] } = await queryRows<ReceiptRow>(
      `SELECT r.id, r.status, r.warehouse_id,
         json_agg(json_build_object(
           'id', ri.id, 'product_id', ri.product_id, 'quantity', ri.quantity, 'received_qty', ri.received_qty
         )) FILTER (WHERE ri.id IS NOT NULL) AS items
         FROM receipts r LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
         WHERE r.id = $1 GROUP BY r.id`,
      [Number(receiptId)]
    )

    if (!receipt) throw Errors.notFound('Receipt not found.')

    const TERMINAL = ['done', 'validated', 'canceled']
    if (TERMINAL.includes(receipt.status))
      throw Errors.badRequest(`Receipt is already ${receipt.status} and cannot be changed.`)

    // Only update stock when the receipt is being marked done/validated
    if (status === 'validated' || status === 'done') {
      if (!items?.length) throw Errors.badRequest('Received quantities are required for validation.')

      await withTransaction(async (client) => {
        for (const item of items) {
          const riRow = (receipt.items ?? []).find((ri: { id: number }) => ri.id === item.receiptItemId)
          if (!riRow) throw new Error(`Receipt item ${item.receiptItemId} not found`)

          const recvQty = Number(item.receivedQty)
          if (recvQty < 0) throw new Error(`Quantity cannot be negative for item ${item.receiptItemId}`)
          if (recvQty > riRow.quantity) throw new Error(`Received qty exceeds ordered qty for item ${item.receiptItemId}`)

          await client.query(`UPDATE receipt_items SET received_qty = $1 WHERE id = $2`, [recvQty, item.receiptItemId])

          if (recvQty > 0) {
            await client.query(
              `INSERT INTO stocks (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)
               ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = stocks.quantity + $3`,
              [riRow.product_id, receipt.warehouse_id, recvQty]
            )
            await client.query(
              `INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta, note)
               VALUES ('receipt', $1, $2, $3, $4, NULL)`,
              [receipt.id, riRow.product_id, receipt.warehouse_id, recvQty]
            )
          }
        }
        await client.query(`UPDATE receipts SET status = $1 WHERE id = $2`, [status, receipt.id])
      })
    } else {
      // Simple status change (draft → waiting → ready | canceled)
      await queryRows(`UPDATE receipts SET status = $1 WHERE id = $2`, [status, Number(receiptId)])
    }

    logger.info('receipt PATCH', `Receipt #${receiptId} → ${status} by ${session.sub}`)
    return NextResponse.json({ message: 'Receipt updated.' })
  } catch (err) {
    return handleRouteError(err, 'receipt PATCH')
  }
}
