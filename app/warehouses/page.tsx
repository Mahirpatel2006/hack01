'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Check, MapPin, Search } from 'lucide-react'
import { useAuth }        from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { PageHeader }     from '@/components/inventory/PageHeader'
import { Button }         from '@/components/ui/Button'
import { Input }          from '@/components/ui/Input'

interface Location { id: number; name: string }
interface Warehouse { 
  id: number; 
  name: string; 
  location: string | null;
  locations: Location[];
  created_at: string;
}

export default function WarehousesPage() {
  const { user, loading, isManager } = useAuth()
  const router = useRouter()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [fetching, setFetching]     = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [name, setName]             = useState('')
  const [location, setLocation]     = useState('')
  const [search, setSearch]         = useState('')
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')
  const [showLocations, setShowLocations] = useState<Warehouse|null>(null)
  const [newLoc, setNewLoc] = useState('')

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
    const res  = await fetch('/api/warehouse', { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify({ name: name.trim(), location: location.trim() || null }) 
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setName(''); setLocation(''); setShowForm(false); load(); setSaving(false)
  }

  async function addLocation() {
    if (!showLocations || !newLoc.trim()) return
    setSaving(true)
    const res = await fetch('/api/location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newLoc.trim(), warehouseId: showLocations.id })
    })
    if (res.ok) {
      setNewLoc('')
      const d = await fetch('/api/warehouse').then(r => r.json())
      setWarehouses(d.warehouses ?? [])
      const updated = d.warehouses?.find((w:Warehouse) => w.id === showLocations.id)
      if (updated) setShowLocations(updated)
    }
    setSaving(false)
  }

  async function deleteLocation(id: number) {
    if (!confirm('Delete this location?')) return
    await fetch(`/api/location?id=${id}`, { method: 'DELETE' })
    const d = await fetch('/api/warehouse').then(r => r.json())
    setWarehouses(d.warehouses ?? [])
    const updated = d.warehouses?.find((w:Warehouse) => w.id === showLocations?.id)
    if (updated) setShowLocations(updated)
  }

  const filtered = warehouses.filter(w => 
    w.name.toLowerCase().includes(search.toLowerCase()) || 
    (w.location?.toLowerCase().includes(search.toLowerCase()))
  )

  const columns: Column<Warehouse>[] = [
    { 
      key:'name', 
      header:'Warehouse', 
      render: w => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-foreground">{w.name}</p>
            <p className="text-xs text-muted-foreground">{w.location || 'No location set'}</p>
          </div>
        </div>
      ) 
    },
    {
      key: 'locations',
      header: 'Locations',
      render: w => (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold bg-muted px-2 py-1 rounded-lg border border-border">
            {w.locations?.length ?? 0}
          </span>
          <Button variant="secondary" onClick={() => setShowLocations(w)} className="text-[10px] h-7 px-2 font-bold uppercase tracking-widest">
            Manage
          </Button>
        </div>
      )
    },
    { 
      key:'created_at', 
      header:'Created', 
      render: w => <span className="text-sm text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</span> 
    }
  ]

  if (loading || !user) return null

  return (
    <div className="p-6 md:p-8 space-y-8">
      <PageHeader
        title="Warehouses"
        subtitle="Manage your physical storage sites and branches."
        action={isManager && (
          <Button onClick={() => setShowForm(true)} className="shadow-lg shadow-primary/20"><Plus className="w-4 h-4 mr-2" /> Add Warehouse</Button>
        )}
      />

      <div className="flex items-center gap-4 bg-(--muted)/30 p-2 rounded-2xl border border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            className="w-full bg-transparent border-none outline-none pl-10 pr-4 py-2 text-sm placeholder:text-muted-foreground"
            placeholder="Search by name or location..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative animate-in fade-in zoom-in duration-200 shadow-2xl">
            <button onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
            <div className="mb-6">
              <h2 className="text-2xl font-black mb-1 text-foreground">New Warehouse</h2>
              <p className="text-sm text-muted-foreground font-medium">Define a new physical storage location.</p>
            </div>
            
            <div className="space-y-4">
              <Input label="Warehouse Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Main Store, DC 1" autoFocus required />
              <Input label="Location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Brooklyn, NY" />
            </div>

            {error && <p className="text-destructive text-sm mt-3 bg-destructive/10 p-3 rounded-lg border border-destructive/20 font-medium">{error}</p>}
            
            <div className="flex gap-3 mt-8">
              <Button onClick={handleSave} loading={saving} className="flex-1 h-12 text-base shadow-lg shadow-primary/20"><Check className="w-5 h-5 mr-2" /> Create Warehouse</Button>
              <Button variant="secondary" onClick={() => setShowForm(false)} className="h-12 text-base px-6">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {showLocations && (
        <div className="fixed inset-0 bg-(--background)/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="card-base w-full max-w-md relative animate-in fade-in zoom-in duration-200 shadow-2xl">
            <button onClick={() => setShowLocations(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"><X className="w-5 h-5" /></button>
            <div className="mb-6">
              <h2 className="text-2xl font-black mb-1 text-foreground">Manage Locations</h2>
              <p className="text-sm text-muted-foreground font-medium">Internal zones for {showLocations.name}</p>
            </div>
            
            <div className="flex gap-2 mb-6">
              <input 
                className="input-base flex-1" 
                placeholder="New location name (e.g. Row A)" 
                value={newLoc}
                onChange={e => setNewLoc(e.target.value)}
              />
              <Button onClick={addLocation} loading={saving} disabled={!newLoc.trim()}><Plus className="w-4 h-4" /></Button>
            </div>

            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
              {showLocations.locations?.map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 bg-(--muted)/30 rounded-xl border border-border group">
                  <span className="font-semibold text-sm text-foreground">{l.name}</span>
                  <button 
                    onClick={() => deleteLocation(l.id)}
                    className="p-1 px-2 text-xs font-bold text-destructive/50 hover:text-destructive hover:bg-(--destructive)/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </div>
              ))}
              {(!showLocations.locations || showLocations.locations.length === 0) && (
                <p className="text-center py-8 text-sm text-muted-foreground font-medium italic">No locations defined for this warehouse.</p>
              )}
            </div>

            <div className="flex gap-3 mt-8 pt-6 border-t border-border">
              <Button variant="secondary" onClick={() => setShowLocations(null)} className="w-full">Done</Button>
            </div>
          </div>
        </div>
      )}

      <DataTable 
        columns={columns} 
        rows={filtered} 
        loading={fetching} 
        keyExtractor={w => w.id} 
        emptyMessage={search ? "No matches found for your search." : "No warehouses yet. Add your first storage site."} 
      />
    </div>
  )
}
