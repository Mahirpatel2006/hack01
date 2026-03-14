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

interface Location { id: number; name: string }
interface Warehouse { id: number; name: string; locations: Location[] }
interface TransferItem { id:number; product_id:number; quantity:number; transferred_qty:number; product:{id:number;name:string;sku:string} }
interface Transfer { 
  id:number; 
  status:string; 
  created_at:string; 
  fromWarehouse:{id:number;name:string}; 
  toWarehouse:{id:number;name:string}; 
  fromLocation: {id:number; name:string} | null;
  toLocation: {id:number; name:string} | null;
  items:TransferItem[] 
}

export default function TransfersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [transfers, setTransfers]   = useState<Transfer[]>([])
  const [products, setProducts]     = useState<{id:number;name:string;sku:string}[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showComplete, setShowComplete] = useState<Transfer|null>(null)
  const [form, setForm] = useState({ fromWarehouseId:'', toWarehouseId:'', fromLocationId:'', toLocationId:'', items:[{productId:'',quantity:'1'}] })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])
  const load = () => {
    setFetching(true)
    Promise.all([fetch('/api/transfer').then(r=>r.json()), fetch('/api/product').then(r=>r.json()), fetch('/api/warehouse').then(r=>r.json())])
      .then(([t,p,w]) => { setTransfers(t.transfers??[]); setProducts(p.products??[]); setWarehouses(w.warehouses??[]) })
      .finally(() => setFetching(false))
  }
  useEffect(() => { if (user) load() }, [user])

  const columns: Column<Transfer>[] = [
    { key:'id',    header:'#',   render: t => `T-${t.id}` },
    { 
      key:'from',  
      header:'From', 
      render: t => (
        <div>
          <p className="font-semibold text-foreground text-sm">{t.fromWarehouse?.name}</p>
          {t.fromLocation && <p className="text-[10px] text-muted-foreground font-medium">📍 {t.fromLocation.name}</p>}
        </div>
      )
    },
    { 
      key:'to',    
      header:'To',   
      render: t => (
        <div>
          <p className="font-semibold text-foreground text-sm">{t.toWarehouse?.name}</p>
          {t.toLocation && <p className="text-[10px] text-muted-foreground font-medium">📍 {t.toLocation.name}</p>}
        </div>
      )
    },
    { key:'items', header:'Items', render: t => `${t.items?.length ?? 0} lines` },
    { key:'status',   header:'Status',    render: t => <StatusBadge status={t.status} /> },
    { key:'created_at', header:'Date',   render: t => new Date(t.created_at).toLocaleDateString() },
    { key:'actions',  header:'', render: t => {
      const isTerminal = ['done', 'completed', 'canceled'].includes(t.status);
      if (isTerminal) return <span className="text-xs text-(--success) font-semibold uppercase tracking-wider">{t.status}</span>;
      
      return (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <select 
            className="text-[10px] bg-(--muted) border-(--border) rounded-lg px-2 py-1 font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-(--primary) transition-all"
            value={t.status}
            onChange={(e) => updateStatus(t.id, e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="waiting">Waiting</option>
            <option value="ready">Ready</option>
            <option value="canceled">Cancel</option>
          </select>
          <Button variant="secondary" onClick={() => { setShowComplete(t); setError('') }} className="text-[10px] h-7 px-2 font-bold uppercase tracking-widest">
            <CheckCircle className="w-3 h-3 mr-1" /> Transfer
          </Button>
        </div>
      );
    }},
  ]

  async function handleCreate() {
    setSaving(true); setError('')
    const items = form.items.filter(i=>i.productId&&Number(i.quantity)>0).map(i=>({productId:Number(i.productId),quantity:Number(i.quantity)}))
    if (!form.fromWarehouseId||!form.toWarehouseId||!items.length) { setError('Fill all fields.'); setSaving(false); return }
    const res = await fetch('/api/transfer', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ 
        fromWarehouseId: Number(form.fromWarehouseId), 
        toWarehouseId: Number(form.toWarehouseId), 
        fromLocationId: form.fromLocationId ? Number(form.fromLocationId) : null,
        toLocationId: form.toLocationId ? Number(form.toLocationId) : null,
        items 
      }) 
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false); setForm({fromWarehouseId:'',toWarehouseId:'',fromLocationId:'',toLocationId:'',items:[{productId:'',quantity:'1'}]}); load(); setSaving(false)
  }

  async function updateStatus(id: number, newStatus: string) {
    setSaving(true); setError('')
    const res = await fetch('/api/transfer', { 
      method:'PATCH', 
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ transferId: id, status: newStatus }) 
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
    } else {
      load()
    }
    setSaving(false)
  }

  async function handleComplete() {
    if (!showComplete) return
    setSaving(true); setError('')
    const res = await fetch('/api/transfer',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({transferId:showComplete.id,status:'completed'})})
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowComplete(null); load(); setSaving(false)
  }

  if (loading || !user) return null

  const filteredTransfers = transfers.filter(t => {
    let matches = true
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      matches = matches && (t.fromWarehouse?.name.toLowerCase().includes(q) || t.toWarehouse?.name.toLowerCase().includes(q))
    }
    if (filterStatus) matches = matches && t.status === filterStatus
    return matches
  })
  const hasActiveFilters = Boolean(searchQuery || filterStatus)
  const clearFilters = () => { setSearchQuery(''); setFilterStatus('') }

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Transfers" subtitle="Move stock between warehouses."
        action={<Button onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4"/> New Transfer</Button>}
      />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by warehouse..."
        filters={[
          {
            key: 'status', label: 'Status', value: filterStatus, onChange: setFilterStatus,
            options: [ 
              { label: 'All Statuses', value: '' }, 
              { label: 'Draft', value: 'draft' }, 
              { label: 'Waiting', value: 'waiting' }, 
              { label: 'Ready', value: 'ready' }, 
              { label: 'Done', value: 'done' }, 
              { label: 'Completed', value: 'completed' },
              { label: 'Canceled', value: 'canceled' } 
            ]
          }
        ]}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />
      {showCreate && (
        <div className="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-lg relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button onClick={()=>setShowCreate(false)} className="absolute top-5 right-5 text-(--muted-foreground) hover:text-(--primary) transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-6 tracking-tight text-(--foreground)">New Internal Transfer</h2>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">From Warehouse</label>
                    <select value={form.fromWarehouseId} 
                      onChange={e => setForm(f=>({...f, fromWarehouseId: e.target.value, fromLocationId: ''}))} 
                      className="input-base"
                    >
                      <option value="">Select source…</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">From Location</label>
                    <select value={form.fromLocationId} 
                      onChange={e => setForm(f=>({...f, fromLocationId: e.target.value}))} 
                      className="input-base"
                      disabled={!form.fromWarehouseId}
                    >
                      <option value="">Select location…</option>
                      {warehouses.find(w => String(w.id) === form.fromWarehouseId)?.locations?.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">To Warehouse</label>
                    <select value={form.toWarehouseId} 
                      onChange={e => setForm(f=>({...f, toWarehouseId: e.target.value, toLocationId: ''}))} 
                      className="input-base"
                    >
                      <option value="">Select dest…</option>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">To Location</label>
                    <select value={form.toLocationId} 
                      onChange={e => setForm(f=>({...f, toLocationId: e.target.value}))} 
                      className="input-base"
                      disabled={!form.toWarehouseId}
                    >
                      <option value="">Select location…</option>
                      {warehouses.find(w => String(w.id) === form.toWarehouseId)?.locations?.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="pt-2">
                <label className="block text-xs font-bold text-(--muted-foreground) uppercase tracking-widest mb-3">Products</label>
                <div className="space-y-3 bg-[var(--muted)]/30 p-4 rounded-2xl border border-[var(--border)]">
                  {form.items.map((item,idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                      <select value={item.productId} onChange={e=>{const it=[...form.items];it[idx]={...item,productId:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base w-full sm:flex-1">
                        <option value="">Select product…</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <div className="flex w-full sm:w-auto items-center gap-2">
                        <input type="number" value={item.quantity} min="1" onChange={e=>{const it=[...form.items];it[idx]={...item,quantity:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base w-full sm:w-24 text-center" placeholder="Qty" />
                        {form.items.length > 1 && (
                          <button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}))} 
                            className="p-3 bg-[var(--destructive)]/10 text-(--destructive) rounded-xl hover:bg-[var(--destructive)] hover:text-white transition-colors">
                            <X className="w-4 h-4"/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={()=>setForm(f=>({...f,items:[...f.items,{productId:'',quantity:'1'}]}))} 
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-(--primary) hover:text-(--primary)/80 mt-2 py-1 px-2 hover:bg-[var(--primary)]/10 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" /> ADD ANOTHER LINE
                  </button>
                </div>
              </div>

              {error&&<p className="text-(--destructive) text-sm font-semibold">{error}</p>}
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[var(--border)] mt-6">
                <Button onClick={handleCreate} loading={saving} className="w-full sm:flex-1"><Check className="w-4 h-4"/> Create Transfer</Button>
                <Button variant="secondary" onClick={()=>setShowCreate(false)} className="w-full sm:w-auto">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showComplete && (
        <div className="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative shadow-2xl">
            <button onClick={()=>setShowComplete(null)} className="absolute top-5 right-5 text-(--muted-foreground) hover:text-(--primary) transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-2 tracking-tight text-(--foreground)">Complete Transfer</h2>
            <p className="text-sm text-(--muted-foreground) mb-6 bg-[var(--muted)]/50 p-3 rounded-lg border border-[var(--border)] gap-2 flex items-center justify-center">
              <strong className="text-(--foreground)">{showComplete.fromWarehouse?.name}</strong> 
              <span className="text-(--primary)">→</span> 
              <strong className="text-(--foreground)">{showComplete.toWarehouse?.name}</strong>
            </p>
            <div className="space-y-2 mb-6 max-h-[40vh] overflow-y-auto pr-2">
              {showComplete.items?.map(i=>(
                <div key={i.id} className="flex justify-between items-center text-sm py-3 px-4 bg-[var(--muted)]/30 rounded-xl border border-[var(--border)]">
                  <span className="font-semibold text-(--foreground)">{i.product?.name}</span>
                  <span className="font-mono font-bold text-(--muted-foreground) bg-[var(--background)] px-2 py-1 rounded-md">{i.quantity} units</span>
                </div>
              ))}
            </div>
            {error&&<p className="text-(--destructive) text-sm font-semibold mb-3">{error}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleComplete} loading={saving} className="w-full sm:flex-1"><CheckCircle className="w-4 h-4"/> Move Stock</Button>
              <Button variant="secondary" onClick={()=>setShowComplete(null)} className="w-full sm:w-auto">Cancel</Button>
            </div>
          </div>
        </div>
      )}
      <DataTable columns={columns} rows={filteredTransfers} loading={fetching} keyExtractor={t=>t.id} emptyMessage="No transfers match your filters." />
    </div>
  )
}
