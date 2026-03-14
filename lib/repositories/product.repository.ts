import { queryOne, queryRows } from '@/lib/db'
import type { Product, Category } from '@/types'

export interface ProductFilters {
  categoryId?: number; search?: string; includeDeleted?: boolean; page?: number; limit?: number
}
export interface CreateProductInput {
  name: string; sku: string; uom: string; category_id?: number | null; reorder_qty?: number
}
export interface UpdateProductInput {
  name?: string; uom?: string; category_id?: number | null; reorder_qty?: number
}

export async function findProducts(filters: ProductFilters = {}): Promise<{ products: Product[]; total: number }> {
  const { categoryId, search, includeDeleted = false, page = 1, limit = 50 } = filters
  const offset = (page - 1) * limit
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (!includeDeleted) conditions.push(`p.deleted_at IS NULL`)
  if (categoryId) { conditions.push(`p.category_id = $${i++}`); params.push(categoryId) }
  if (search) { conditions.push(`(p.name ILIKE $${i} OR p.sku ILIKE $${i})`); params.push(`%${search}%`); i++ }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const { rows: countRows } = await queryRows<{ total: string }>(
    `SELECT COUNT(*) AS total FROM products p ${where}`, [...params]
  )
  const total = parseInt(countRows[0]?.total ?? '0')

  const dataParams = [...params, limit, offset]
  const { rows } = await queryRows<Record<string, unknown>>(`
    SELECT p.id, p.name, p.sku, p.uom, p.reorder_qty, p.is_active, p.created_at, p.updated_at,
           c.id AS category_id, c.name AS category_name,
           COALESCE(json_agg(json_build_object('id', s.id, 'warehouse_id', s.warehouse_id, 'quantity', s.quantity)) FILTER (WHERE s.id IS NOT NULL), '[]') AS stocks
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stocks s     ON s.product_id = p.id
    ${where}
    GROUP BY p.id, c.id
    ORDER BY p.id DESC
    LIMIT $${i++} OFFSET $${i++}
  `, dataParams)

  const products = rows.map(r => ({ ...r, category: r.category_id ? { id: r.category_id, name: r.category_name } : null })) as unknown as Product[]
  return { products, total }
}

export async function findProductById(id: number, includeDeleted = false): Promise<Product | null> {
  const row = await queryOne<Record<string, unknown>>(`
    SELECT p.id, p.name, p.sku, p.uom, p.reorder_qty, p.is_active, p.created_at, p.updated_at,
           c.id AS category_id, c.name AS category_name,
           COALESCE(json_agg(json_build_object('id', s.id, 'warehouse_id', s.warehouse_id, 'quantity', s.quantity)) FILTER (WHERE s.id IS NOT NULL), '[]') AS stocks
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN stocks s     ON s.product_id = p.id
    WHERE p.id = $1 ${!includeDeleted ? 'AND p.deleted_at IS NULL' : ''}
    GROUP BY p.id, c.id
  `, [id])
  if (!row) return null
  return { ...row, category: row.category_id ? { id: row.category_id, name: row.category_name } : null } as unknown as Product
}

export async function createProduct(input: CreateProductInput): Promise<Product> {
  const product = await queryOne<Product>(
    `INSERT INTO products (name, sku, uom, category_id, reorder_qty) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [input.name.trim(), input.sku.trim().toUpperCase(), input.uom.trim(), input.category_id ?? null, input.reorder_qty ?? 10]
  )
  if (!product) throw new Error('Product insert failed')
  return product
}

export async function softDeleteProduct(id: number): Promise<boolean> {
  const { rows } = await queryRows(`UPDATE products SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id`, [id])
  return rows.length > 0
}

export async function findAllCategories(): Promise<Category[]> {
  const { rows } = await queryRows<Category>(`SELECT id, name FROM categories ORDER BY name ASC`)
  return rows
}
