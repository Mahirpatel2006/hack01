import { queryOne, queryRows } from '@/lib/db'
import type { StockMove } from '@/types'

export interface StockMoveFilters {
  type?: string; productId?: number; warehouseId?: number; page?: number; limit?: number
}

export async function findStockMoves(filters: StockMoveFilters = {}): Promise<{ moves: StockMove[]; total: number }> {
  const { type, productId, warehouseId, page = 1, limit = 50 } = filters
  const offset = (page - 1) * limit
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (type)        { conditions.push(`sm.move_type = $${i++}`);    params.push(type) }
  if (productId)   { conditions.push(`sm.product_id = $${i++}`);   params.push(productId) }
  if (warehouseId) { conditions.push(`sm.warehouse_id = $${i++}`); params.push(warehouseId) }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows: countRows } = await queryRows<{ total: string }>(
    `SELECT COUNT(*) AS total FROM stock_moves sm ${where}`, [...params]
  )
  const total = parseInt(countRows[0]?.total ?? '0')

  const { rows } = await queryRows<Record<string, unknown>>(`
    SELECT sm.id, sm.move_type, sm.ref_id, sm.delta, sm.note, sm.created_at,
           p.id AS product_id, p.name AS product_name, p.sku,
           w.id AS warehouse_id, w.name AS warehouse_name
    FROM stock_moves sm
    JOIN products p   ON p.id = sm.product_id
    JOIN warehouses w ON w.id = sm.warehouse_id
    ${where}
    ORDER BY sm.created_at DESC
    LIMIT $${i++} OFFSET $${i++}
  `, [...params, limit, offset])

  const moves = rows.map(r => ({
    ...r,
    product:   { id: r.product_id,   name: r.product_name, sku: r.sku },
    warehouse: { id: r.warehouse_id, name: r.warehouse_name },
  })) as unknown as StockMove[]

  return { moves, total }
}

export async function getStockLevel(productId: number, warehouseId: number): Promise<number> {
  const row = await queryOne<{ quantity: number }>(
    `SELECT quantity FROM stocks WHERE product_id = $1 AND warehouse_id = $2`, [productId, warehouseId]
  )
  return row?.quantity ?? 0
}
