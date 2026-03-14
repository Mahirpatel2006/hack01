import { queryOne, queryRows } from '@/lib/db'
import type { Warehouse } from '@/types'

export async function findAllWarehouses(includeDeleted = false): Promise<Warehouse[]> {
  const { rows } = await queryRows<Warehouse>(
    `SELECT id, name, location, is_active, created_at FROM warehouses ${!includeDeleted ? 'WHERE deleted_at IS NULL' : ''} ORDER BY name ASC`
  )
  return rows
}

export async function findWarehouseById(id: number): Promise<Warehouse | null> {
  return queryOne<Warehouse>(
    `SELECT id, name, location, is_active, created_at FROM warehouses WHERE id = $1 AND deleted_at IS NULL`, [id]
  )
}

export async function createWarehouse(name: string, location?: string): Promise<Warehouse> {
  const wh = await queryOne<Warehouse>(
    `INSERT INTO warehouses (name, location) VALUES ($1, $2) RETURNING *`, [name.trim(), location?.trim() ?? null]
  )
  if (!wh) throw new Error('Warehouse insert failed')
  return wh
}

export async function updateWarehouse(id: number, name: string, location?: string): Promise<Warehouse | null> {
  return queryOne<Warehouse>(
    `UPDATE warehouses SET name = $1, location = $2 WHERE id = $3 AND deleted_at IS NULL RETURNING *`,
    [name.trim(), location?.trim() ?? null, id]
  )
}

export async function softDeleteWarehouse(id: number): Promise<boolean> {
  const { rows } = await queryRows(
    `UPDATE warehouses SET deleted_at = NOW(), is_active = FALSE WHERE id = $1 AND deleted_at IS NULL RETURNING id`, [id]
  )
  return rows.length > 0
}
