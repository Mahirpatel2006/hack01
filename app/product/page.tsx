'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil, X, Check } from 'lucide-react'
import { useAuth }        from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { FilterBar }      from '@/components/inventory/FilterBar'
import { PageHeader }     from '@/components/inventory/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Input }          from '@/components/ui/Input'

interface Category { id: number; name: string }
interface Stock     { warehouse_id: number; quantity: number }
interface Product   { id: number; name: string; sku: string; uom: string; reorder_qty: number; category: Category|null; stocks: Stock[] }

export default function ProductPage() {
  const { user, loading, isManager } = useAuth()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [warehouses, setWarehouses] = useState<{id:number;name:string}[]>([])
  const [fetching, setFetching]  = useState(true)
  const [showForm, setShowForm]  = useState(false)
  const [editId, setEditId]      = useState<number|null>(null)
  const [form, setForm] = useState({ name:'', sku:'', uom:'', category:'', reorder_qty:'10', quantity:'', warehouseId:'' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStock, setFilterStock] = useState('')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])
  useEffect(() => { if (!loading && user && !isManager) router.push('/access-denied') }, [user, loading, isManager, router])

  const loadData = () => {
    setFetching(true)
    Promise.all([
      fetch('/api/product').then(r => r.json()),
      fetch('/api/category').then(r => r.json()),
      fetch('/api/warehouse').then(r => r.json()),
    ]).then(([p, c, w]) => {
      setProducts(p.products ?? [])
      setCategories(c.categories ?? [])
      setWarehouses(w.warehouses ?? [])
    }).finally(() => setFetching(false))
  }
  useEffect(() => { if (user) loadData() }, [user])

  const totalStock = (p: Product) => p.stocks?.reduce((s, st) => s + st.quantity, 0) ?? 0

  const columns: Column<Product>[] = [
    { key:'name',  header:'Product', render: p => (
      <div>
        <p className="font-semibold text-[var(--foreground)]">{p.name}</p>
        <p className="text-xs text-[var(--muted-foreground)] font-mono">{p.sku}</p>
      </div>
    )},
    { key:'category', header:'Category', render: p => <span className="text-[var(--muted-foreground)]">{p.category?.name ?? '—'}</span> },
    { key:'uom', header:'UoM', render: p => <span className="badge-base bg-[var(--muted)] text-[var(--foreground)]">{p.uom}</span> },
    { key:'stock', header:'Total Stock', render: p => {
      const qty = totalStock(p)
      const low = qty < p.reorder_qty
      return <span className={`font-bold ${qty === 0 ? 'text-[var(--destructive)]' : low ? 'text-amber-500' : 'text-[var(--success)]'}`}>{qty} {p.uom}</span>
    }},
    ...(isManager ? [{ key:'actions', header:'', render: (p: Product) => (
      <div className="flex gap-2 justify-end">
        <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg hover:bg-[var(--muted)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-[var(--destructive)]/10 text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    ), className:'w-20'}] as Column<Product>[] : []),
  ]

  function startEdit(p: Product) {
    setEditId(p.id)
    setForm({ name: p.name, sku: p.sku, uom: p.uom, category: p.category?.name ?? '', reorder_qty: String(p.reorder_qty), quantity:'', warehouseId:'' })
    setShowForm(true); setError('')
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const url  = editId ? '/api/product/update' : '/api/product/add'
      const meth = editId ? 'PATCH' : 'POST'
      const body = editId ? { id: editId, ...form, reorder_qty: Number(form.reorder_qty) }
        : { ...form, reorder_qty: Number(form.reorder_qty), quantity: Number(form.quantity), warehouseId: Number(form.warehouseId) }
      const res = await fetch(url, { method: meth, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowForm(false); setEditId(null); setForm({ name:'',sku:'',uom:'',category:'',reorder_qty:'10',quantity:'',warehouseId:'' }); loadData()
    } catch (e) { setError((e as Error).message) }
    setSaving(false)
  }

  async function deleteProduct(id: number) {
    if (!confirm('Delete this product? This cannot be undone.')) return
    await fetch(`/api/product?id=${id}`, { method:'DELETE' })
    loadData()
  }

  if (loading || !user) return null

  // Apply filters
  const filteredProducts = products.filter(p => {
    let matches = true
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      matches = matches && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
    }
    if (filterCategory) {
      matches = matches && p.category?.name === filterCategory
    }
    if (filterStock) {
      const qty = totalStock(p)
      if (filterStock === 'out') matches = matches && qty === 0
      if (filterStock === 'low') matches = matches && qty > 0 && qty < p.reorder_qty
      if (filterStock === 'ok')  matches = matches && qty >= p.reorder_qty
    }
    return matches
  })

  const hasActiveFilters = Boolean(searchQuery || filterCategory || filterStock)
  const clearFilters = () => { setSearchQuery(''); setFilterCategory(''); setFilterStock('') }

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Products"
        subtitle="Manage your product catalog and stock levels."
        action={isManager && (
          <Button onClick={() => { setShowForm(true); setEditId(null); setError('') }}>
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        )}
      />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search products by name or SKU..."
        filters={[
          {
            key: 'category',
            label: 'Category',
            value: filterCategory,
            onChange: setFilterCategory,
            options: [
              { label: 'All Categories', value: '' },
              ...categories.map(c => ({ label: c.name, value: c.name }))
            ]
          },
          {
            key: 'stock',
            label: 'Stock Status',
            value: filterStock,
            onChange: setFilterStock,
            options: [
              { label: 'All Statuses', value: '' },
              { label: 'In Stock', value: 'ok' },
              { label: 'Low Stock', value: 'low' },
              { label: 'Out of Stock', value: 'out' }
            ]
          }
        ]}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-lg relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><X className="w-5 h-5" /></button>
            <h2 className="text-xl font-black mb-6">{editId ? 'Edit Product' : 'Add Product'}</h2>
            <div className="space-y-4">
              <Input label="Product Name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="SKU / Code" value={form.sku}  onChange={e => setForm(f => ({...f, sku:  e.target.value}))} required />
                <Input label="Unit of Measure (e.g. kg, pcs)" value={form.uom} onChange={e => setForm(f => ({...f, uom: e.target.value}))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Category</label>
                  <input list="categories-list" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                    className="input-base w-full" placeholder="e.g. Steel, Hardware" />
                  <datalist id="categories-list">{categories.map(c => <option key={c.id} value={c.name} />)}</datalist>
                </div>
                <Input type="number" label="Reorder Alert Qty" value={form.reorder_qty} onChange={e => setForm(f => ({...f, reorder_qty: e.target.value}))} />
              </div>
              {!editId && (
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" label="Initial Stock (optional)" value={form.quantity} onChange={e => setForm(f => ({...f, quantity: e.target.value}))} />
                  <div>
                    <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Warehouse</label>
                    <select value={form.warehouseId} onChange={e => setForm(f => ({...f, warehouseId: e.target.value}))} className="input-base w-full">
                      <option value="">Select warehouse…</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                </div>
              )}
              {error && <p className="text-[var(--destructive)] text-sm font-medium">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleSave} loading={saving} className="flex-1"><Check className="w-4 h-4" /> {editId ? 'Update' : 'Create'} Product</Button>
                <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DataTable columns={columns} rows={filteredProducts} loading={fetching} keyExtractor={p => p.id} emptyMessage="No products match your filters." />
    </div>
  )
}
