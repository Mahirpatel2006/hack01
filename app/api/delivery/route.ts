import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

const DELIVERY_WITH_JOINS = `
  SELECT d.id, d.customer, d.status, d.created_at,
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
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const status = new URL(req.url).searchParams.get('status')
    const where  = status ? `WHERE d.status = $1` : ''
    const { rows } = await queryRows(
      `${DELIVERY_WITH_JOINS} ${where} GROUP BY d.id ORDER BY d.created_at DESC`,
      status ? [status] : []
    )
    return NextResponse.json({ deliveries: rows })
  } catch (err) {
    console.error('[delivery GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { customer, items } = await req.json()
    if (!customer?.trim() || !items?.length) {
      return NextResponse.json({ error: 'Customer and at least one item are required.' }, { status: 400 })
    }

    const delivery = await withTransaction(async (client) => {
      const { rows: [d] } = await client.query(
        `INSERT INTO deliveries (customer, status) VALUES ($1, 'draft') RETURNING *`,
        [customer.trim()]
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

    return NextResponse.json({ message: 'Delivery created.', delivery }, { status: 201 })
  } catch (err) {
    console.error('[delivery POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { deliveryId, status } = await req.json()
    if (!deliveryId || status !== 'validated') return NextResponse.json({ error: 'deliveryId and status=validated required.' }, { status: 400 })

    const { rows: [d] } = await queryRows(`SELECT * FROM deliveries WHERE id = $1`, [Number(deliveryId)])
    if (!d) return NextResponse.json({ error: 'Delivery not found.' }, { status: 404 })
    if (d.status === 'validated') return NextResponse.json({ error: 'Already validated.' }, { status: 400 })

    const { rows: items } = await queryRows(`SELECT * FROM delivery_items WHERE delivery_id = $1`, [Number(deliveryId)])

    await withTransaction(async (client) => {
      for (const item of items) {
        // Check stock
        const { rows: [stk] } = await client.query(
          `SELECT quantity FROM stocks WHERE product_id = $1 AND warehouse_id = $2`,
          [item.product_id, item.warehouse_id]
        )
        if (!stk || stk.quantity < item.quantity) {
          throw new Error(`Insufficient stock for product ID ${item.product_id} in warehouse ${item.warehouse_id}.`)
        }
        await client.query(
          `UPDATE stocks SET quantity = quantity - $1 WHERE product_id = $2 AND warehouse_id = $3`,
          [item.quantity, item.product_id, item.warehouse_id]
        )
        await client.query(
          `INSERT INTO stock_moves (move_type, ref_id, product_id, warehouse_id, delta)
           VALUES ('delivery', $1, $2, $3, $4)`,
          [d.id, item.product_id, item.warehouse_id, -item.quantity]
        )
      }
      await client.query(`UPDATE deliveries SET status = 'validated' WHERE id = $1`, [d.id])
    })

    return NextResponse.json({ message: 'Delivery validated. Stock decremented.' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error.'
    console.error('[delivery PATCH]', err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
