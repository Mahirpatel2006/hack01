import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'

export async function GET() {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

    const { rows } = await queryRows(`
      SELECT p.id, p.name, p.sku, p.uom, p.reorder_qty, p.created_at,
             c.id AS category_id, c.name AS category_name,
             COALESCE(
               json_agg(
                 json_build_object('id', s.id, 'warehouse_id', s.warehouse_id, 'quantity', s.quantity)
               ) FILTER (WHERE s.id IS NOT NULL), '[]'
             ) AS stocks
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stocks s     ON s.product_id = p.id
      GROUP BY p.id, c.id
      ORDER BY p.id DESC
    `)

    const products = rows.map((r: Record<string,unknown>) => ({
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
    }))

    return NextResponse.json({ products })
  } catch (err) {
    console.error('[product GET]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (session.role !== 'manager') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const id = parseInt(searchParams.get('id') ?? '')
    if (!id) return NextResponse.json({ error: 'Product ID required.' }, { status: 400 })

    await withTransaction(async (client) => {
      await client.query(`DELETE FROM stocks         WHERE product_id = $1`, [id])
      await client.query(`DELETE FROM receipt_items  WHERE product_id = $1`, [id])
      await client.query(`DELETE FROM delivery_items WHERE product_id = $1`, [id])
      await client.query(`DELETE FROM transfer_items WHERE product_id = $1`, [id])
      await client.query(`DELETE FROM adjustments    WHERE product_id = $1`, [id])
      await client.query(`DELETE FROM stock_moves    WHERE product_id = $1`, [id])
      await client.query(`DELETE FROM products       WHERE id = $1`,          [id])
    })

    return NextResponse.json({ message: 'Product deleted.' })
  } catch (err) {
    console.error('[product DELETE]', err)
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
  }
}
