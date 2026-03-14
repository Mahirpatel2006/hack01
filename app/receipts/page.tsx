'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle, X, Check } from 'lucide-react'
import { useAuth }        from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { StatusBadge }    from '@/components/inventory/StatusBadge'
import { PageHeader }     from '@/components/inventory/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Input }          from '@/components/ui/Input'

interface ReceiptItem { id: number; product_id: number; quantity: number; received_qty: number; product: { id:number; name:string; sku:string } }
interface Receipt { id: number; supplier: string; status: string; receipt_date: string; warehouse: { id:number; name:string }; items: ReceiptItem[] }

export default function ReceiptsPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [receipts, setReceipts]  = useState<Receipt[]>([])
  const [products, setProducts]  = useState<{id:number;name:string;sku:string}[]>([])
  const [warehouses, setWarehouses] = useState<{id:number;name:string}[]>([])
  const [fetching, setFetching]  = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showValidate, setShowValidate] = useState<Receipt|null>(null)
  const [form, setForm] = useState({ supplier:'', warehouseId:'', items: [{ productId:'', quantity:'1' }] })
  const [recvQtys, setRecvQtys]  = useState<Record<number, string>>({})
  const [saving, setSaving]      = useState(false)
  const [error, setError]        = useState('')

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
    { key:'warehouse', header:'Warehouse', render: r => r.warehouse?.name ?? '—' },
    { key:'items', header:'Items', render: r => `${r.items?.length ?? 0} lines` },
    { key:'status', header:'Status', render: r => <StatusBadge status={r.status} /> },
    { key:'receipt_date', header:'Date', render: r => new Date(r.receipt_date).toLocaleDateString() },
    { key:'actions', header:'', render: r => r.status === 'draft' ? (
      <Button variant="secondary" onClick={(e) => { e.stopPropagation(); openValidate(r) }} className="text-xs h-8 px-3">
        <CheckCircle className="w-3.5 h-3.5" /> Validate
      </Button>
    ) : <span className="text-xs text-[var(--success)] font-semibold">Validated</span> },
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
      body: JSON.stringify({ supplier: form.supplier, warehouseId: Number(form.warehouseId), items }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false); setForm({ supplier:'', warehouseId:'', items:[{productId:'',quantity:'1'}] }); load(); setSaving(false)
  }

  async function handleValidate() {
    if (!showValidate) return
    setSaving(true); setError('')
    const items = showValidate.items.map(i => ({ receiptItemId: i.id, receivedQty: Number(recvQtys[i.id] ?? i.quantity) }))
    const res = await fetch('/api/receipt', { method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ receiptId: showValidate.id, status:'validated', items }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowValidate(null); load(); setSaving(false)
  }

  if (loading || !user) return null

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Receipts" subtitle="Manage incoming goods from vendors."
        action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4"/> New Receipt</Button>}
      />

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowCreate(false)} className="absolute top-4 right-4 text-[var(--muted-foreground)]"><X className="w-5 h-5"/></button>
            <h2 className="text-xl font-black mb-6">New Receipt</h2>
            <div className="space-y-4">
              <Input label="Supplier" value={form.supplier} onChange={e => setForm(f=>({...f, supplier: e.target.value}))} required />
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Destination Warehouse</label>
                <select value={form.warehouseId} onChange={e => setForm(f=>({...f, warehouseId: e.target.value}))} className="input-base w-full">
                  <option value="">Select…</option>
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Products</label>
                {form.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <select value={item.productId} onChange={e => { const items=[...form.items]; items[idx]={...item, productId:e.target.value}; setForm(f=>({...f,items})) }} className="input-base flex-1">
                      <option value="">Select product…</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                    </select>
                    <input type="number" value={item.quantity} min="1" onChange={e => { const items=[...form.items]; items[idx]={...item, quantity:e.target.value}; setForm(f=>({...f,items})) }} className="input-base w-24" />
                    {form.items.length > 1 && <button onClick={() => { const items=form.items.filter((_,i)=>i!==idx); setForm(f=>({...f,items})) }} className="p-2 text-[var(--destructive)]"><X className="w-4 h-4"/></button>}
                  </div>
                ))}
                <button onClick={() => setForm(f=>({...f, items:[...f.items,{productId:'',quantity:'1'}]}))} className="text-xs text-[var(--primary)] font-semibold mt-1 hover:underline">+ Add line</button>
              </div>
              {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button onClick={handleCreate} loading={saving} className="flex-1"><Check className="w-4 h-4"/> Create Receipt</Button>
                <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validate modal */}
      {showValidate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowValidate(null)} className="absolute top-4 right-4 text-[var(--muted-foreground)]"><X className="w-5 h-5"/></button>
            <h2 className="text-xl font-black mb-2">Validate Receipt</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-6">Enter the actual quantities received.</p>
            <div className="space-y-3">
              {showValidate.items?.map(item => (
                <div key={item.id} className="flex items-center justified-between gap-3">
                  <p className="flex-1 text-sm font-medium">{item.product?.name} <span className="text-[var(--muted-foreground)]">({item.product?.sku})</span></p>
                  <p className="text-xs text-[var(--muted-foreground)] shrink-0">Ordered: {item.quantity}</p>
                  <input type="number" value={recvQtys[item.id] ?? item.quantity} min="0" max={item.quantity}
                    onChange={e => setRecvQtys(q=>({...q,[item.id]:e.target.value}))} className="input-base w-24 shrink-0" />
                </div>
              ))}
              {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}
              <div className="flex gap-3 pt-4">
                <Button onClick={handleValidate} loading={saving} className="flex-1"><CheckCircle className="w-4 h-4"/> Validate & Update Stock</Button>
                <Button variant="secondary" onClick={() => setShowValidate(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DataTable columns={columns} rows={receipts} loading={fetching} keyExtractor={r => r.id} emptyMessage="No receipts yet." />
    </div>
  )
}
