'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Check } from 'lucide-react'
import { useAuth }        from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { PageHeader }     from '@/components/inventory/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Input }          from '@/components/ui/Input'

interface Warehouse { id: number; name: string; created_at: string }

export default function WarehousesPage() {
  const { user, loading, isManager } = useAuth()
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching]     = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [name, setName]             = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])
  useEffect(() => { if (!loading && user && !isManager) router.push('/access-denied') }, [user, loading, isManager, router])

  const load = () => {
    setFetching(true)
    fetch('/api/warehouse').then(r => r.json()).then(d => setWarehouses(d.warehouses ?? [])).finally(() => setFetching(false))
  }
  useEffect(() => { if (user) load() }, [user])

  async function handleSave() {
    if (!name.trim()) return setError('Warehouse name is required.')
    setSaving(true); setError('')
    const res  = await fetch('/api/warehouse', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setName(''); setShowForm(false); load(); setSaving(false)
  }

  const columns: Column<Warehouse>[] = [
    { key:'name', header:'Warehouse', render: w => <p className="font-semibold text-[var(--foreground)]">{w.name}</p> },
    { key:'created_at', header:'Created', render: w => <span className="text-sm text-[var(--muted-foreground)]">{new Date(w.created_at).toLocaleDateString()}</span> },
  ]

  if (loading || !user) return null

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Warehouses"
        subtitle="Configure your storage locations."
        action={isManager && (
          <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4" /> Add Warehouse</Button>
        )}
      />

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-[var(--muted-foreground)]"><X className="w-5 h-5" /></button>
            <h2 className="text-xl font-black mb-6">New Warehouse</h2>
            <Input label="Warehouse Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Store, Rack A" autoFocus required />
            {error && <p className="text-[var(--destructive)] text-sm mt-3">{error}</p>}
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSave} loading={saving} className="flex-1"><Check className="w-4 h-4" /> Create</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <DataTable columns={columns} rows={warehouses} loading={fetching} keyExtractor={w => w.id} emptyMessage="No warehouses yet. Add your first location." />
    </div>
  )
}
