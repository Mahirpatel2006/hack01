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

interface Location { id: number; name: string }
interface Warehouse { id: number; name: string; locations: Location[] }
interface ReceiptItem { id: number; product_id: number; quantity: number; received_qty: number; product: { id:number; name:string; sku:string } }
interface Receipt { 
  id: number; 
  supplier: string; 
  status: string; 
  receipt_date: string; 
  warehouse: { id:number; name:string }; 
  location: { id:number; name:string } | null;
  items: ReceiptItem[] 
}

export default function ReceiptsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [receipts, setReceipts]  = useState<Receipt[]>([])
  const [products, setProducts]  = useState<{id:number;name:string;sku:string}[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching]  = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showValidate, setShowValidate] = useState<Receipt|null>(null)
  const [form, setForm] = useState({ supplier:'', warehouseId:'', locationId:'', items: [{ productId:'', quantity:'1' }] })
  const [recvQtys, setRecvQtys]  = useState<Record<number, string>>({})
  const [saving, setSaving]      = useState(false)
  const [error, setError]        = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  const load = () => {
    setFetching(true)
    Promise.all([
      fetch('/api/receipt').then(r=>r.json()),
      fetch('/api/product').then(r=>r.json()),
      fetch('/api/warehouse').then(r=>r.json()),
    ]).then(([rc,pr,wh]) => {
      setReceipts(rc.receipts ?? [])
      setProducts(pr.products ?? [])
      setWarehouses(wh.warehouses ?? [])
    }).finally(() => setFetching(false))
  }
  useEffect(() => { if (user) load() }, [user])

  const columns: Column<Receipt>[] = [
    { key:'id', header:'#', render: r => `R-${r.id}` },
    { key:'supplier', header:'Supplier', render: r => <p className="font-semibold">{r.supplier}</p> },
    { 
      key:'warehouse', 
      header:'Destination', 
      render: r => (
        <div className="flex flex-col">
          <p className="font-semibold text-foreground text-sm">{r.warehouse?.name}</p>
          {r.location && <p className="text-[10px] text-muted-foreground font-medium">📍 {r.location.name}</p>}
        </div>
      ) 
    },
    { key:'items', header:'Items', render: r => `${r.items?.length ?? 0} lines` },
    { key:'status', header:'Status', render: r => <StatusBadge status={r.status} /> },
    { key:'receipt_date', header:'Date', render: r => new Date(r.receipt_date).toLocaleDateString() },
    { key:'actions', header:'', render: r => {
      const isTerminal = ['done', 'validated', 'canceled'].includes(r.status);
      if (isTerminal) return <span className="text-xs text-(--success) font-semibold uppercase tracking-wider">{r.status}</span>;
      
      return (
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <select 
            className="text-[10px] bg-(--muted) border-(--border) rounded-lg px-2 py-1 font-bold uppercase tracking-wider outline-none focus:ring-1 focus:ring-(--primary) transition-all"
            value={r.status}
            onChange={(e) => updateStatus(r.id, e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="waiting">Waiting</option>
            <option value="ready">Ready</option>
            <option value="canceled">Cancel</option>
          </select>
          <Button variant="secondary" onClick={() => openValidate(r)} className="text-[10px] h-7 px-2 font-bold uppercase tracking-widest">
            <CheckCircle className="w-3 h-3 mr-1" /> Validate
          </Button>
        </div>
      );
    }},
  ]

  function openValidate(r: Receipt) {
    const init: Record<number,string> = {}
    r.items?.forEach(i => { init[i.id] = String(i.quantity) })
    setRecvQtys(init); setShowValidate(r); setError('')
  }

  async function handleCreate() {
    setSaving(true); setError('')
    const items = form.items.filter(i => i.productId && Number(i.quantity) > 0)
      .map(i => ({ productId: Number(i.productId), quantity: Number(i.quantity) }))
    if (!form.supplier.trim() || !form.warehouseId || !items.length) {
      setError('Fill all fields and add at least one product.'); setSaving(false); return
    }
    const res = await fetch('/api/receipt', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ supplier: form.supplier, warehouseId: Number(form.warehouseId), locationId: form.locationId ? Number(form.locationId) : null, items }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false); setForm({ supplier:'', warehouseId:'', locationId:'', items:[{productId:'',quantity:'1'}] }); load(); setSaving(false)
  }

  async function updateStatus(id: number, newStatus: string) {
    setSaving(true); setError('')
    const res = await fetch('/api/receipt', { 
      method:'PATCH', 
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ receiptId: id, status: newStatus }) 
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error)
    } else {
      load()
    }
    setSaving(false)
  }

  async function handleValidate() {
    if (!showValidate) return
    setSaving(true); setError('')
    const items = showValidate.items.map(i => ({ receiptItemId: i.id, receivedQty: Number(recvQtys[i.id] ?? i.quantity) }))
    const res = await fetch('/api/receipt', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ receiptId: showValidate.id, status:'done', items }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowValidate(null); load(); setSaving(false)
  }

  if (loading || !user) return null

  const filteredReceipts = receipts.filter(r => {
    let matches = true
    if (searchQuery) matches = matches && r.supplier.toLowerCase().includes(searchQuery.toLowerCase())
    if (filterStatus) matches = matches && r.status === filterStatus
    if (filterWarehouse) matches = matches && r.warehouse?.id.toString() === filterWarehouse
    return matches
  })
  const hasActiveFilters = Boolean(searchQuery || filterStatus || filterWarehouse)
  const clearFilters = () => { setSearchQuery(''); setFilterStatus(''); setFilterWarehouse('') }

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Receipts" subtitle="Manage incoming goods from vendors."
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4"/> New Receipt</Button>}
      />

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by supplier..."
        filters={[
          {
            key: 'status', label: 'Status', value: filterStatus, onChange: setFilterStatus,
            options: [ 
              { label: 'All Statuses', value: '' }, 
              { label: 'Draft', value: 'draft' }, 
              { label: 'Waiting', value: 'waiting' }, 
              { label: 'Ready', value: 'ready' }, 
              { label: 'Done', value: 'done' }, 
              { label: 'Canceled', value: 'canceled' } 
            ]
          },
          {
            key: 'warehouse', label: 'Warehouse', value: filterWarehouse, onChange: setFilterWarehouse,
            options: [ { label: 'All Warehouses', value: '' }, ...warehouses.map(w => ({ label: w.name, value: String(w.id) })) ]
          }
        ]}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-lg relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button onClick={() => setShowCreate(false)} className="absolute top-5 right-5 text-(--muted-foreground) hover:text-(--primary) transition-colors"><X className="w-5 h-5"/></button>
            <h2 className="text-2xl font-black mb-6 tracking-tight text-(--foreground)">New Receipt</h2>
            <div className="space-y-5">
              <Input label="Supplier" value={form.supplier} onChange={e => setForm(f=>({...f, supplier: e.target.value}))} required />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Destination Warehouse</label>
                  <select value={form.warehouseId} 
                    onChange={e => setForm(f=>({...f, warehouseId: e.target.value, locationId: ''}))} 
                    className="input-base"
                  >
                    <option value="">Select warehouse…</option>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Location (Optional)</label>
                  <select value={form.locationId} 
                    onChange={e => setForm(f=>({...f, locationId: e.target.value}))} 
                    className="input-base"
                    disabled={!form.warehouseId}
                  >
                    <option value="">Select location…</option>
                    {warehouses.find(w => String(w.id) === form.warehouseId)?.locations?.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-(--muted-foreground) uppercase tracking-widest mb-3">Products</label>
                <div className="space-y-3 bg-(--muted)/30 p-4 rounded-2xl border border-(--border)">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                      <select value={item.productId} onChange={e => { const items=[...form.items]; items[idx]={...item, productId:e.target.value}; setForm(f=>({...f,items})) }} className="input-base w-full sm:flex-1">
                        <option value="">Select product…</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                      <div className="flex w-full sm:w-auto items-center gap-2">
                        <input type="number" value={item.quantity} min="1" onChange={e => { const items=[...form.items]; items[idx]={...item, quantity:e.target.value}; setForm(f=>({...f,items})) }} className="input-base w-full sm:w-24 text-center" placeholder="Qty" />
                        {form.items.length > 1 && (
                          <button onClick={() => { const items=form.items.filter((_,i)=>i!==idx); setForm(f=>({...f,items})) }} 
                            className="p-3 bg-(--destructive)/10 text-(--destructive) rounded-xl hover:bg-(--destructive) hover:text-white transition-colors">
                            <X className="w-4 h-4"/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => setForm(f=>({...f, items:[...f.items,{productId:'',quantity:'1'}]}))} 
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-(--primary) hover:text-(--primary)/80 mt-2 py-1 px-2 hover:bg-(--primary)/10 rounded-lg transition-colors">
                    <Plus className="w-3.5 h-3.5" /> ADD ANOTHER LINE
                  </button>
                </div>
              </div>

              {error && <p className="text-(--destructive) text-sm font-semibold">{error}</p>}
              
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-(--border) mt-6">
                <Button onClick={handleCreate} loading={saving} className="w-full sm:flex-1"><Check className="w-4 h-4"/> Create Receipt</Button>
                <Button variant="secondary" onClick={() => setShowCreate(false)} className="w-full sm:w-auto">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validate modal */}
      {showValidate && (
        <div className="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative max-h-[90vh] overflow-y-auto shadow-2xl">
            <button onClick={() => setShowValidate(null)} className="absolute top-4 right-4 text-(--muted-foreground)"><X className="w-5 h-5"/></button>
            <h2 className="text-xl font-black mb-2">Validate Receipt</h2>
            <p className="text-sm text-(--muted-foreground) mb-6">Enter the actual quantities received.</p>
            <div className="space-y-3">
              {showValidate.items?.map(item => (
                <div key={item.id} className="flex items-center justified-between gap-3">
                  <p className="flex-1 text-sm font-medium">{item.product?.name} <span className="text-(--muted-foreground)">({item.product?.sku})</span></p>
                  <p className="text-xs text-(--muted-foreground) shrink-0">Ordered: {item.quantity}</p>
                  <input type="number" value={recvQtys[item.id] ?? item.quantity} min="0" max={item.quantity}
                    onChange={e => setRecvQtys(q=>({...q,[item.id]:e.target.value}))} className="input-base w-24 shrink-0" />
                </div>
              ))}
              {error && <p className="text-(--destructive) text-sm">{error}</p>}
              <div className="flex gap-3 pt-4">
                <Button onClick={handleValidate} loading={saving} className="flex-1"><CheckCircle className="w-4 h-4"/> Validate & Update Stock</Button>
                <Button variant="secondary" onClick={() => setShowValidate(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DataTable columns={columns} rows={filteredReceipts} loading={fetching} keyExtractor={r => r.id} emptyMessage="No receipts match your filters." />
    </div>
  )
}
