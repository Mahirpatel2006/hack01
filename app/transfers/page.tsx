'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle, X, Check } from 'lucide-react'
import { useAuth }        from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { StatusBadge }    from '@/components/inventory/StatusBadge'
import { PageHeader }     from '@/components/inventory/PageHeader'
import { Button }         from '@/components/ui/Button'

interface TransferItem { id:number; product_id:number; quantity:number; transferred_qty:number; product:{id:number;name:string;sku:string} }
interface Transfer { id:number; status:string; created_at:string; fromWarehouse:{id:number;name:string}; toWarehouse:{id:number;name:string}; items:TransferItem[] }

export default function TransfersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [transfers, setTransfers]   = useState<Transfer[]>([])
  const [products, setProducts]     = useState<{id:number;name:string;sku:string}[]>([])
  const [warehouses, setWarehouses] = useState<{id:number;name:string}[]>([])
  const [fetching, setFetching]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showComplete, setShowComplete] = useState<Transfer|null>(null)
  const [form, setForm] = useState({ fromWarehouseId:'', toWarehouseId:'', items:[{productId:'',quantity:'1'}] })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

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
    { key:'from',  header:'From', render: t => <p className="font-semibold">{t.fromWarehouse?.name}</p> },
    { key:'to',    header:'To',   render: t => <p className="font-semibold">{t.toWarehouse?.name}</p> },
    { key:'items', header:'Items', render: t => `${t.items?.length ?? 0} lines` },
    { key:'status', header:'Status', render: t => <StatusBadge status={t.status} /> },
    { key:'created_at', header:'Date', render: t => new Date(t.created_at).toLocaleDateString() },
    { key:'actions', header:'', render: t => t.status === 'draft' ? (
      <Button variant="secondary" onClick={e=>{e.stopPropagation();setShowComplete(t);setError('')}} className="text-xs h-8 px-3">
        <CheckCircle className="w-3.5 h-3.5"/> Complete
      </Button>
    ) : <span className="text-xs text-[var(--success)] font-semibold">Completed</span> },
  ]

  async function handleCreate() {
    setSaving(true); setError('')
    const items = form.items.filter(i=>i.productId&&Number(i.quantity)>0).map(i=>({productId:Number(i.productId),quantity:Number(i.quantity)}))
    if (!form.fromWarehouseId||!form.toWarehouseId||!items.length) { setError('Fill all fields.'); setSaving(false); return }
    const res = await fetch('/api/transfer',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fromWarehouseId:Number(form.fromWarehouseId),toWarehouseId:Number(form.toWarehouseId),items})})
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setShowCreate(false); setForm({fromWarehouseId:'',toWarehouseId:'',items:[{productId:'',quantity:'1'}]}); load(); setSaving(false)
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
  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Transfers" subtitle="Move stock between warehouses."
        action={<Button onClick={()=>setShowCreate(true)}><Plus className="w-4 h-4"/> New Transfer</Button>}
      />
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-lg relative max-h-[90vh] overflow-y-auto">
            <button onClick={()=>setShowCreate(false)} className="absolute top-4 right-4 text-[var(--muted-foreground)]"><X className="w-5 h-5"/></button>
            <h2 className="text-xl font-black mb-6">New Internal Transfer</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">From</label>
                <select value={form.fromWarehouseId} onChange={e=>setForm(f=>({...f,fromWarehouseId:e.target.value}))} className="input-base w-full">
                  <option value="">Select…</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">To</label>
                <select value={form.toWarehouseId} onChange={e=>setForm(f=>({...f,toWarehouseId:e.target.value}))} className="input-base w-full">
                  <option value="">Select…</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <label className="block text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-widest mb-2">Products</label>
            {form.items.map((item,idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select value={item.productId} onChange={e=>{const it=[...form.items];it[idx]={...item,productId:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base flex-1">
                  <option value="">Product…</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" value={item.quantity} min="1" onChange={e=>{const it=[...form.items];it[idx]={...item,quantity:e.target.value};setForm(f=>({...f,items:it}))}} className="input-base w-24"/>
                {form.items.length>1&&<button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}))} className="p-2 text-[var(--destructive)]"><X className="w-4 h-4"/></button>}
              </div>
            ))}
            <button onClick={()=>setForm(f=>({...f,items:[...f.items,{productId:'',quantity:'1'}]}))} className="text-xs text-[var(--primary)] font-semibold mt-1 hover:underline">+ Add line</button>
            {error&&<p className="text-[var(--destructive)] text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <Button onClick={handleCreate} loading={saving} className="flex-1"><Check className="w-4 h-4"/> Create Transfer</Button>
              <Button variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      {showComplete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative">
            <button onClick={()=>setShowComplete(null)} className="absolute top-4 right-4 text-[var(--muted-foreground)]"><X className="w-5 h-5"/></button>
            <h2 className="text-xl font-black mb-2">Complete Transfer</h2>
            <p className="text-sm text-[var(--muted-foreground)] mb-5"><strong>{showComplete.fromWarehouse?.name}</strong> → <strong>{showComplete.toWarehouse?.name}</strong></p>
            <div className="space-y-2 mb-6">
              {showComplete.items?.map(i=><div key={i.id} className="flex justify-between text-sm py-2 border-b border-[var(--border)]">
                <span className="font-medium">{i.product?.name}</span><span className="text-[var(--muted-foreground)]">{i.quantity} units</span>
              </div>)}
            </div>
            {error&&<p className="text-[var(--destructive)] text-sm mb-3">{error}</p>}
            <div className="flex gap-3">
              <Button onClick={handleComplete} loading={saving} className="flex-1"><CheckCircle className="w-4 h-4"/> Confirm & Move Stock</Button>
              <Button variant="secondary" onClick={()=>setShowComplete(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
      <DataTable columns={columns} rows={transfers} loading={fetching} keyExtractor={t=>t.id} emptyMessage="No transfers yet." />
    </div>
  )
}
