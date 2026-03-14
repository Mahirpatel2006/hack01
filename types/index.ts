// ─── Shared Domain Types ──────────────────────────────────────────────────────
// Single source of truth for all entity shapes used across UI, services, and API

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type UserRole = 'manager' | 'staff'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthUser {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string | null
  created_at: string
}

export interface Session {
  id: string
  user_id: string
  jti: string
  ip_address: string | null
  user_agent: string | null
  revoked: boolean
  created_at: string
  expires_at: string
}

// ─── Inventory Core ────────────────────────────────────────────────────────────

export interface Category {
  id: number
  name: string
}

export interface Warehouse {
  id: number
  name: string
  location?: string | null
  is_active: boolean
  created_at: string
  deleted_at?: string | null
}

export interface Stock {
  id: number
  product_id: number
  warehouse_id: number
  quantity: number
  warehouse?: Pick<Warehouse, 'id' | 'name'>
}

export interface Product {
  id: number
  name: string
  sku: string
  uom: string
  category_id: number | null
  reorder_qty: number
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
  category?: Category | null
  stocks?: Stock[]
}

// ─── Operations ────────────────────────────────────────────────────────────────

export type ReceiptStatus   = 'draft' | 'validated'
export type DeliveryStatus  = 'draft' | 'validated'
export type TransferStatus  = 'draft' | 'completed'
export type MoveType        = 'receipt' | 'delivery' | 'transfer_out' | 'transfer_in' | 'adjustment'

export interface ReceiptItem {
  id: number
  receipt_id: number
  product_id: number
  quantity: number
  received_qty: number
  product?: Pick<Product, 'id' | 'name' | 'sku'> & { category?: Category | null }
}

export interface Receipt {
  id: number
  supplier: string
  warehouse_id: number
  receipt_date: string
  status: ReceiptStatus
  created_by?: string | null
  created_at: string
  updated_at: string
  warehouse?: Pick<Warehouse, 'id' | 'name'>
  items?: ReceiptItem[]
}

export interface DeliveryItem {
  id: number
  delivery_id: number
  product_id: number
  quantity: number
  warehouse_id: number
  product?: Pick<Product, 'id' | 'name' | 'sku'>
  warehouse?: Pick<Warehouse, 'id' | 'name'>
}

export interface Delivery {
  id: number
  customer: string
  status: DeliveryStatus
  created_by?: string | null
  created_at: string
  updated_at: string
  items?: DeliveryItem[]
}

export interface TransferItem {
  id: number
  transfer_id: number
  product_id: number
  quantity: number
  transferred_qty: number
  product?: Pick<Product, 'id' | 'name' | 'sku'>
}

export interface Transfer {
  id: number
  from_warehouse_id: number
  to_warehouse_id: number
  status: TransferStatus
  created_by?: string | null
  created_at: string
  updated_at: string
  fromWarehouse?: Pick<Warehouse, 'id' | 'name'>
  toWarehouse?: Pick<Warehouse, 'id' | 'name'>
  items?: TransferItem[]
}

export interface Adjustment {
  id: number
  product_id: number
  warehouse_id: number
  quantity: number
  reason: string | null
  created_by?: string | null
  created_at: string
  product?: Pick<Product, 'id' | 'name' | 'sku'>
  warehouse?: Pick<Warehouse, 'id' | 'name'>
  current_stock?: number
}

export interface StockMove {
  id: number
  move_type: MoveType
  ref_id: number
  product_id: number
  warehouse_id: number
  delta: number
  note: string | null
  created_at: string
  product?: Pick<Product, 'id' | 'name' | 'sku'>
  warehouse?: Pick<Warehouse, 'id' | 'name'>
}

// ─── API Responses ─────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, string>
  statusCode?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  pages: number
}

export interface ApiResponse<T = void> {
  message?: string
  data?: T
}

// ─── UI State ──────────────────────────────────────────────────────────────────

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'

export interface TableColumn<T> {
  key: keyof T | string
  label: string
  render?: (value: unknown, row: T) => React.ReactNode
  sortable?: boolean
  className?: string
}
