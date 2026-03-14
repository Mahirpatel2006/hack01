import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { name, sku, uom, category, quantity, warehouseId, reorder_qty } = await req.json()

    if (!name?.trim() || !sku?.trim() || !uom?.trim()) {
      return NextResponse.json({ error: 'Name, SKU, and Unit of Measure are required.' }, { status: 400 })
    }

    const { rows: existingSku } = await queryRows(`SELECT id FROM products WHERE sku = $1`, [sku.trim()])
    if (existingSku.length > 0) return NextResponse.json({ error: 'SKU already exists.' }, { status: 400 })

    const catName = category?.trim() || 'Uncategorized'
    const { rows: catRows } = await queryRows(
      `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [catName]
    )
    const categoryId = (catRows[0] as Record<string,unknown>).id

    const { rows: productRows } = await queryRows(
      `INSERT INTO products (name, sku, uom, category_id, reorder_qty)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name.trim(), sku.trim(), uom.trim(), categoryId, reorder_qty ?? 10]
    )
    const product = productRows[0]

    if (quantity && Number(quantity) > 0 && warehouseId) {
      await queryRows(
        `INSERT INTO stocks (product_id, warehouse_id, quantity)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, warehouse_id) DO UPDATE SET quantity = EXCLUDED.quantity`,
        [(product as Record<string,unknown>).id, Number(warehouseId), Number(quantity)]
      )
    }

    return NextResponse.json({ message: 'Product created.', product }, { status: 201 })
  } catch (err) {
    console.error('[product/add POST]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
