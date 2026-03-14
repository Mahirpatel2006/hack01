import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

const RECEIPT_WITH_JOINS = `
  SELECT r.id, r.supplier, r.status, r.receipt_date, r.created_at,
         w.id AS warehouse_id, w.name AS warehouse_name,
         COALESCE(json_agg(json_build_object(
           'id',           ri.id,
           'product_id',   ri.product_id,
           'quantity',     ri.quantity,
           'received_qty', ri.received_qty,
           'product',      json_build_object('id', p.id, 'name', p.name, 'sku', p.sku,
                             'category', json_build_object('id', c.id, 'name', c.name))
         )) FILTER (WHERE ri.id IS NOT NULL), '[]') AS items
  FROM receipts r
  JOIN warehouses w ON w.id = r.warehouse_id
  LEFT JOIN receipt_items ri ON ri.receipt_id = r.id
  LEFT JOIN products p       ON p.id = ri.product_id
  LEFT JOIN categories c     ON c.id = p.category_id
`

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const status = new URL(req.url).searchParams.get('status')
    const where  = status ? `WHERE r.status = $1` : ''
    const params = status ? [status] : []

    const { rows } = await queryRows(
      `${RECEIPT_WITH_JOINS} ${where} GROUP BY r.id, w.id ORDER BY r.created_at DESC`,
      params
    )
    const receipts = rows.map(r => ({
      ...r, warehouse: { id: r.warehouse_id, name: r.warehouse_name }
    }))
    return NextResponse.json({ receipts })
  } catch (err) {
    console.error('[receipt GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { supplier, warehouseId, receiptDate, items } = await req.json()
    if (!supplier?.trim() || !warehouseId || !items?.length) {
      return NextResponse.json({ error: 'Supplier, warehouse, and at least one item are required.' }, { status: 400 })
    }

    const receipt = await withTransaction(async (client) => {
      const { rows: [r] } = await client.query(
        `INSERT INTO receipts (supplier, warehouse_id, receipt_date, status)
         VALUES ($1, $2, $3, 'draft') RETURNING *`,
        [supplier.trim(), Number(warehouseId), receiptDate ? new Date(receiptDate) : new Date()]
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

    return NextResponse.json({ message: 'Receipt created.', receipt }, { status: 201 })
  } catch (err) {
    console.error('[receipt POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { receiptId, status, items } = await req.json()
    if (!receiptId) return NextResponse.json({ error: 'Receipt ID required.' }, { status: 400 })

    // Fetch receipt + items
    const { rows: [receipt] } = await queryRows(
      `SELECT r.*, json_agg(json_build_object('id', ri.id, 'product_id', ri.product_id, 'quantity', ri.quantity))
         AS items FROM receipts r LEFT JOIN receipt_items ri ON ri.receipt_id = r.id WHERE r.id = $1 GROUP BY r.id`,
      [Number(receiptId)]
    )
    if (!receipt) return NextResponse.json({ error: 'Receipt not found.' }, { status: 404 })
    if (receipt.status === 'validated') return NextResponse.json({ error: 'Receipt already validated.' }, { status: 400 })

    if (status === 'validated') {
      if (!items?.length) return NextResponse.json({ error: 'Items required for validation.' }, { status: 400 })

      await withTransaction(async (client) => {
        for (const item of items) {
          const riRow   = receipt.items.find((ri: { id: number }) => ri.id === item.receiptItemId)
          if (!riRow) throw new Error(`Receipt item ${item.receiptItemId} not found`)
          const recvQty = Number(item.receivedQty)
          if (recvQty < 0 || recvQty > riRow.quantity) throw new Error(`Invalid quantity for item ${item.receiptItemId}`)

          await client.query(`UPDATE receipt_items SET received_qty = $1 WHERE id = $2`, [recvQty, item.receiptItemId])

          if (recvQty > 0) {
            await client.query(`
              INSERT INTO stocks (product_id, warehouse_id, quantity)
              VALUES ($1, $2, $3)
              ON CONFLICT (product_id, warehouse_id)
              DO UPDATE SET quantity = stocks.quantity + $3`,
              [riRow.product_id, receipt.warehouse_id, recvQty]
            )
            await client.query(`
              INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta)
              VALUES ('receipt', $1, $2, $3, $4)`,
              [receipt.id, riRow.product_id, receipt.warehouse_id, recvQty]
            )
          }
        }
        await client.query(`UPDATE receipts SET status = 'validated' WHERE id = $1`, [receipt.id])
      })
    }

    return NextResponse.json({ message: 'Receipt updated.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error.'
    console.error('[receipt PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
