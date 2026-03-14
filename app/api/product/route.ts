import { NextResponse, type NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { queryRows, withTransaction } from '@/lib/db'
import { logger } from '@/lib/logger'
import { handleRouteError, Errors } from '@/lib/errors'
import { sanitize } from '@/lib/validation'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) throw Errors.unauthorized()

    const { searchParams } = new URL(req.url)
    const search     = searchParams.get('search') ?? ''
    const categoryId = searchParams.get('categoryId')
    const page       = Math.max(1, parseInt(searchParams.get('page')  ?? '1'))
    const limit      = Math.min(100, parseInt(searchParams.get('limit') ?? '25'))
    const offset     = (page - 1) * limit

    const conditions: string[] = ['p.deleted_at IS NULL']
    const params: unknown[] = []
    let i = 1

    if (search) {
      conditions.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i})`)
      params.push(`%${sanitize(search)}%`); i++
    }
    if (categoryId) { conditions.push(`p.category_id = $${i++}`); params.push(Number(categoryId)) }

    const where = `WHERE ${conditions.join(' AND ')}`

    const { rows: countRows } = await queryRows<{ total: string }>(
      `SELECT COUNT(*) AS total FROM products p ${where}`, [...params]
    )
    const total = parseInt(countRows[0]?.total ?? '0')

    const dataParams = [...params, limit, offset]
    const { rows } = await queryRows(`
      SELECT p.id, p.name, p.sku, p.uom, p.reorder_qty, p.is_active, p.created_at, p.updated_at,
             c.id AS category_id, c.name AS category_name,
             COALESCE(
               json_agg(json_build_object('id', s.id, 'warehouse_id', s.warehouse_id, 'quantity', s.quantity))
               FILTER (WHERE s.id IS NOT NULL), '[]'
             ) AS stocks
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN stocks s     ON s.product_id = p.id
      ${where}
      GROUP BY p.id, c.id
      ORDER BY p.id DESC
      LIMIT $${i++} OFFSET $${i++}
    `, dataParams)

    const products = rows.map((r: Record<string, unknown>) => ({
      ...r,
      category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
    }))

    return NextResponse.json({ products, total, page, limit, pages: Math.ceil(total / limit) })
  } catch (err) {
    return handleRouteError(err, 'product GET')
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session)                   throw Errors.unauthorized()
    if (session.role !== 'manager') throw Errors.forbidden()

    const { searchParams } = new URL(req.url)
    const id = parseInt(searchParams.get('id') ?? '')
    if (!id) throw Errors.badRequest('Product ID is required.')

    await withTransaction(async (client) => {
      await client.query(`UPDATE products SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`, [id])
    })

    logger.info('product DELETE', `Product #${id} soft-deleted by ${session.sub}`)
    return NextResponse.json({ message: 'Product deleted.' })
  } catch (err) {
    return handleRouteError(err, 'product DELETE')
  }
}
