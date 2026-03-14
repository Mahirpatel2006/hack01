'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Check } from 'lucide-react'
import { useAuth }       from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { PageHeader }    from '@/components/inventory/PageHeader'
import { Button }        from '@/components/ui/Button'
import { Input }         from '@/components/ui/Input'

interface Adjustment { id:number; quantity:number; reason:string|null; created_at:string; product:{id:number;name:string;sku:string}; warehouse:{id:number;name:string}; current_stock:number }

export default function AdjustmentsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [adjustments, setAdj]   = useState<Adjustment[]>([])
  const [products, setProducts] = useState<{id:number;name:string;sku:string}[]>([])
  const [warehouses, setWH]     = useState<{id:number;name:string}[]>([])
  const [fetching, setFetching] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ productId:'', warehouseId:'', quantity:'', reason:'' })
  const [currentStock, setCurrentStock] = useState<number|null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])
  const load = () => {
    setFetching(true)
    Promise.all([fetch('/api/adjustment').then(r=>r.json()), fetch('/api/product').then(r=>r.json()), fetch('/api/warehouse').then(r=>r.json())])
      .then(([a,p,w]) => { setAdj(a.adjustments??[]); setProducts(p.products??[]); setWH(w.warehouses??[]) })
      .finally(() => setFetching(false))
  }
  useEffect(() => { if (user) load() }, [user])

  // Auto-fill current stock when product+warehouse selected
  useEffect(() => {
    if (!form.productId || !form.warehouseId) { setCurrentStock(null); return }
    const adj = adjustments.find(a => a.product.id === Number(form.productId) && a.warehouse.id === Number(form.warehouseId))
    setCurrentStock(adj?.current_stock ?? 0)
  }, [form.productId, form.warehouseId, adjustments])

  async function handleSave() {
    setSaving(true); setError('')
    if (!form.productId || !form.warehouseId || form.quantity === '') { setError('All fields required.'); setSaving(false); return }
    const res = await fetch('/api/adjustment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:Number(form.productId), warehouseId:Number(form.warehouseId), quantity:Number(form.quantity), reason:form.reason})})
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowForm(false); setForm({productId:'',warehouseId:'',quantity:'',reason:''}); load(); setSaving(false)
  }

  const columns: Column<Adjustment>[] = [
    { key:'product',   header:'Product',   render: a => <div><p className="font-semibold">{a.product?.name}</p><p className="text-xs text-[var(--muted-foreground)] font-mono">{a.product?.sku}</p></div> },
    { key:'warehouse', header:'Warehouse', render: a => a.warehouse?.name },
    { key:'quantity',  header:'Count Set', render: a => <span className="font-bold text-[var(--primary)]">{a.quantity}</span> },
    { key:'reason',    header:'Reason',    render: a => <span className="text-[var(--muted-foreground)]">{a.reason ?? '—'}</span> },
    { key:'created_at',header:'Date',      render: a => new Date(a.created_at).toLocaleDateString() },
  ]

  if (loading || !user) return null
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Stock Adjustments" subtitle="Fix discrepancies between recorded and physical stock."
        action={<Button onClick={()=>setShowForm(true)}><Plus className="w-4 h-4"/> New Adjustment</Button>}
      />
      {showForm && (
        <div className="fixed inset-0 bg-[var(--background)]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative shadow-2xl">
            <button onClick={()=>setShowForm(false)} className="absolute top-5 right-5 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-6 tracking-tight text-[var(--foreground)]">Record Adjustment</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Product</label>
                <select value={form.productId} onChange={e=>setForm(f=>({...f,productId:e.target.value}))} className="input-base w-full">
                  <option value="">Select…</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Warehouse</label>
                <select value={form.warehouseId} onChange={e=>setForm(f=>({...f,warehouseId:e.target.value}))} className="input-base w-full">
                  <option value="">Select…</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              {currentStock !== null && (
                <p className="text-sm font-medium text-[var(--muted-foreground)] bg-[var(--muted)]/50 rounded-xl px-4 py-3 border border-[var(--border)]">
                  Current recorded stock: <strong className="text-[var(--foreground)] font-mono">{currentStock}</strong>
                </p>
              )}
              <Input type="number" label="Physical Count (new quantity)" value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:e.target.value}))} placeholder="Enter actual counted qty" min="0" required />
              <Input label="Reason (optional)" value={form.reason} onChange={e=>setForm(f=>({...f,reason:e.target.value}))} placeholder="e.g. Damaged goods, recount" />
              {error&&<p className="text-[var(--destructive)] text-sm font-semibold">{error}</p>}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)] mt-6">
                <Button onClick={handleSave} loading={saving} className="w-full sm:flex-1"><Check className="w-4 h-4"/> Apply Adjustment</Button>
                <Button variant="secondary" onClick={()=>setShowForm(false)} className="w-full sm:w-auto">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <DataTable columns={columns} rows={adjustments} loading={fetching} keyExtractor={a=>a.id} emptyMessage="No adjustments recorded." />
    </div>
  )
}
