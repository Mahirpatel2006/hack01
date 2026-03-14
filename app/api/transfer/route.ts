import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

const TRANSFER_WITH_JOINS = `
  SELECT t.id, t.status, t.created_at,
         fw.id AS from_id, fw.name AS from_name,
         tw.id AS to_id,   tw.name AS to_name,
         COALESCE(json_agg(json_build_object(
           'id',              ti.id,
           'product_id',      ti.product_id,
           'quantity',        ti.quantity,
           'transferred_qty', ti.transferred_qty,
           'product',         json_build_object('id', p.id, 'name', p.name, 'sku', p.sku)
         )) FILTER (WHERE ti.id IS NOT NULL), '[]') AS items
  FROM transfers t
  JOIN warehouses fw ON fw.id = t.from_warehouse_id
  JOIN warehouses tw ON tw.id = t.to_warehouse_id
  LEFT JOIN transfer_items ti ON ti.transfer_id = t.id
  LEFT JOIN products p        ON p.id = ti.product_id
`

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const status = new URL(req.url).searchParams.get('status')
    const where  = status ? `WHERE t.status = $1` : ''
    const { rows } = await queryRows(
      `${TRANSFER_WITH_JOINS} ${where} GROUP BY t.id, fw.id, tw.id ORDER BY t.created_at DESC`,
      status ? [status] : []
    )
    const transfers = rows.map(r => ({
      ...r,
      fromWarehouse: { id: r.from_id, name: r.from_name },
      toWarehouse:   { id: r.to_id,   name: r.to_name   },
    }))
    return NextResponse.json({ transfers })
  } catch (err) {
    console.error('[transfer GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { fromWarehouseId, toWarehouseId, items } = await req.json()
    if (!fromWarehouseId || !toWarehouseId || !items?.length) {
      return NextResponse.json({ error: 'Both warehouses and at least one item required.' }, { status: 400 })
    }
    if (Number(fromWarehouseId) === Number(toWarehouseId)) {
      return NextResponse.json({ error: 'Source and destination warehouses must be different.' }, { status: 400 })
    }

    const transfer = await withTransaction(async (client) => {
      const { rows: [t] } = await client.query(
        `INSERT INTO transfers (from_warehouse_id, to_warehouse_id, status)
         VALUES ($1, $2, 'draft') RETURNING *`,
        [Number(fromWarehouseId), Number(toWarehouseId)]
      )
      for (const item of items) {
        await client.query(
          `INSERT INTO transfer_items (transfer_id, product_id, quantity, transferred_qty)
           VALUES ($1, $2, $3, 0)`,
          [t.id, Number(item.productId), Number(item.quantity)]
        )
      }
      return t
    })

    return NextResponse.json({ message: 'Transfer created.', transfer }, { status: 201 })
  } catch (err) {
    console.error('[transfer POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { transferId, status } = await req.json()
    if (!transferId || status !== 'completed') {
      return NextResponse.json({ error: 'transferId and status=completed required.' }, { status: 400 })
    }

    const { rows: [t] } = await queryRows(`SELECT * FROM transfers WHERE id = $1`, [Number(transferId)])
    if (!t) return NextResponse.json({ error: 'Transfer not found.' }, { status: 404 })
    if (t.status === 'completed') return NextResponse.json({ error: 'Already completed.' }, { status: 400 })

    const { rows: items } = await queryRows(`SELECT * FROM transfer_items WHERE transfer_id = $1`, [Number(transferId)])

    await withTransaction(async (client) => {
      for (const item of items) {
        // Guard: check source stock
        const { rows: [src] } = await client.query(
          `SELECT quantity FROM stocks WHERE product_id = $1 AND warehouse_id = $2`,
          [item.product_id, t.from_warehouse_id]
        )
        if (!src || src.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id} in source warehouse.`)
        }

        // Decrement source
        await client.query(
          `UPDATE stocks SET quantity = quantity - $1 WHERE product_id = $2 AND warehouse_id = $3`,
          [item.quantity, item.product_id, t.from_warehouse_id]
        )

        // Upsert destination
        await client.query(
          `INSERT INTO stocks (product_id, warehouse_id, quantity) VALUES ($1, $2, $3)
           ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = stocks.quantity + $3`,
          [item.product_id, t.to_warehouse_id, item.quantity]
        )

        // Log in ledger
        await client.query(
          `INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta) VALUES
           ('transfer_out', $1, $2, $3, $4),
           ('transfer_in',  $1, $2, $5, $4)`,
          [t.id, item.product_id, t.from_warehouse_id, item.quantity, t.to_warehouse_id]
        )

        await client.query(
          `UPDATE transfer_items SET transferred_qty = $1 WHERE id = $2`,
          [item.quantity, item.id]
        )
      }
      await client.query(`UPDATE transfers SET status = 'completed' WHERE id = $1`, [t.id])
    })

    return NextResponse.json({ message: 'Transfer completed. Stock moved.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error.'
    console.error('[transfer PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
