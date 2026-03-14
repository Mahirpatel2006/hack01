'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle, X, Check } from 'lucide-react'
import { useAuth }        from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { StatusBadge }    from '@/components/inventory/StatusBadge'
import { FilterBar }      from '@/components/inventory/FilterBar'
import { PageHeader }     from '@/components/inventory/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Input }          from '@/components/ui/Input'

interface DeliveryItem { id: number; product_id: number; quantity: number; warehouse_id: number; product:{id:number;name:string;sku:string}; warehouse:{id:number;name:string} }
interface Delivery { id: number; customer: string; status: string; created_at: string; items: DeliveryItem[] }

export default function DeliveriesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [products, setProducts]     = useState<{id:number;name:string;sku:string}[]>([])
  const [warehouses, setWarehouses] = useState<{id:number;name:string}[]>([])
  const [fetching, setFetching]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showValidate, setShowValidate] = useState<Delivery|null>(null)
  const [form, setForm] = useState({ customer:'', items:[{productId:'', quantity:'1', warehouseId:''}] })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])
  const load = () => {
    setFetching(true)
    Promise.all([fetch('/api/delivery').then(r=>r.json()), fetch('/api/product').then(r=>r.json()), fetch('/api/warehouse').then(r=>r.json())])
      .then(([d,p,w]) => { setDeliveries(d.deliveries??[]); setProducts(p.products??[]); setWarehouses(w.warehouses??[]) })
      .finally(() => setFetching(false))
  }
  useEffect(() => { if (user) load() }, [user])

  const columns: Column<Delivery>[] = [
    { key:'id',       header:'#',         render: d => `D-${d.id}` },
    { key:'customer', header:'Customer',  render: d => <p className="font-semibold">{d.customer}</p> },
    { key:'items',    header:'Items',     render: d => `${d.items?.length ?? 0} lines` },
    { key:'status',   header:'Status',    render: d => <StatusBadge status={d.status} /> },
    { key:'created_at', header:'Date',   render: d => new Date(d.created_at).toLocaleDateString() },
    { key:'actions',  header:'', render: d => d.status === 'draft' ? (
      <Button variant="secondary" onClick={e=>{e.stopPropagation(); setShowValidate(d); setError('')}} className="text-xs h-8 px-3">
        <CheckCircle className="w-3.5 h-3.5"/> Validate
      </Button>
    ) : <span className="text-xs text-[var(--success)] font-semibold">Validated</span> },
  ]

  async function handleCreate() {
    setSaving(true); setError('')
    const items = form.items.filter(i=>i.productId&&i.warehouseId&&Number(i.quantity)>0).map(i=>({productId:Number(i.productId),quantity:Number(i.quantity),warehouseId:Number(i.warehouseId)}))
    if (!form.customer.trim()||!items.length) { setError('Fill all fields.'); setSaving(false); return }
    const res = await fetch('/api/delivery',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer:form.customer,items})})
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false); setForm({customer:'',items:[{productId:'',quantity:'1',warehouseId:''}]}); load(); setSaving(false)
  }

  async function handleValidate() {
    if (!showValidate) return
    setSaving(true); setError('')
    const res = await fetch('/api/delivery',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({deliveryId:showValidate.id,status:'validated'})})
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowValidate(null); load(); setSaving(false)
  }

  if (loading || !user) return null

  const filteredDeliveries = deliveries.filter(d => {
    let matches = true
    if (searchQuery) matches = matches && d.customer.toLowerCase().includes(searchQuery.toLowerCase())
    if (filterStatus) matches = matches && d.status === filterStatus
    return matches
  })
  const hasActiveFilters = Boolean(searchQuery || filterStatus)
  const clearFilters = () => { setSearchQuery(''); setFilterStatus('') }

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Deliveries" subtitle="Manage outgoing goods to customers."
        action={<Button onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4"/> New Delivery</Button>}
      />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by customer..."
        filters={[
          {
            key: 'status', label: 'Status', value: filterStatus, onChange: setFilterStatus,
            options: [ { label: 'All Statuses', value: '' }, { label: 'Draft', value: 'draft' }, { label: 'Validated', value: 'validated' } ]
          }
        ]}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />
      {showCreate && (
        <div className="fixed inset-0 bg-[var(--background)]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-lg relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button onClick={()=>setShowCreate(false)} className="absolute top-5 right-5 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-6 tracking-tight text-[var(--foreground)]">New Delivery Order</h2>
            <div className="space-y-5">
              <Input label="Customer" value={form.customer} onChange={e=>setForm(f=>({...f,customer:e.target.value}))} required />
              
              <div className="pt-2">
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-3">Items</label>
                <div className="space-y-3 bg-[var(--muted)]/30 p-4 rounded-2xl border border-[var(--border)]">
                  {form.items.map((item,idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                      <select value={item.productId} onChange={e=>{const it=[...form.items];it[idx]={...item,productId:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base w-full sm:flex-1">
                        <option value="">Product…</option>
                        {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="flex w-full sm:w-auto items-center gap-2">
                        <select value={item.warehouseId} onChange={e=>{const it=[...form.items];it[idx]={...item,warehouseId:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base w-full sm:w-36">
                          <option value="">From…</option>
                          {warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                        <input type="number" value={item.quantity} min="1" onChange={e=>{const it=[...form.items];it[idx]={...item,quantity:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base w-full sm:w-24 text-center" placeholder="Qty" />
                        {form.items.length>1 && (
                          <button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}))} 
                            className="p-3 bg-[var(--destructive)]/10 text-[var(--destructive)] rounded-xl hover:bg-[var(--destructive)] hover:text-white transition-colors">
                            <X className="w-4 h-4"/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={()=>setForm(f=>({...f,items:[...f.items,{productId:'',quantity:'1',warehouseId:''}]}))} 
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--primary)] hover:text-[var(--primary)]/80 mt-2 py-1 px-2 hover:bg-[var(--primary)]/10 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" /> ADD ANOTHER LINE
                  </button>
                </div>
              </div>

              {error&&<p className="text-[var(--destructive)] text-sm font-semibold">{error}</p>}
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)] mt-6">
                <Button onClick={handleCreate} loading={saving} className="w-full sm:flex-1"><Check className="w-4 h-4"/> Create Delivery</Button>
                <Button variant="secondary" onClick={()=>setShowCreate(false)} className="w-full sm:w-auto">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showValidate && (
        <div className="fixed inset-0 bg-[var(--background)]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative shadow-2xl">
            <button onClick={()=>setShowValidate(null)} className="absolute top-5 right-5 text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-2 tracking-tight text-[var(--foreground)]">Validate Delivery</h2>
            <p className="text-sm font-medium text-[var(--muted-foreground)] mb-6 bg-[var(--muted)]/50 p-3 rounded-lg border border-[var(--border)]">
              This will deduct the following from stock:
            </p>
            <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {showValidate.items?.map(i => (
                <div key={i.id} className="flex justify-between items-center text-sm py-3 px-4 bg-[var(--muted)]/30 rounded-xl border border-[var(--border)]">
                  <span className="font-semibold text-[var(--foreground)]">{i.product?.name}</span>
                  <span className="font-mono font-bold text-[var(--muted-foreground)] bg-[var(--background)] px-2 py-1 rounded-md">−{i.quantity} <span className="text-[10px] uppercase font-sans font-bold ml-1">from {i.warehouse?.name}</span></span>
                </div>
              ))}
            </div>
            {error&&<p className="text-[var(--destructive)] text-sm font-semibold mb-3">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleValidate} loading={saving} className="w-full sm:flex-1"><CheckCircle className="w-4 h-4"/> Confirm & Validate</Button>
              <Button variant="secondary" onClick={()=>setShowValidate(null)} className="w-full sm:w-auto">Cancel</Button>
            </div>
          </div>
        </div>
      )}
      <DataTable columns={columns} rows={filteredDeliveries} loading={fetching} keyExtractor={d=>d.id} emptyMessage="No deliveries match your filters." />
    </div>
  )
}
