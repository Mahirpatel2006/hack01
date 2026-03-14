'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownToLine, ArrowUpFromLine, Shuffle, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { DataTable, type Column } from '@/components/inventory/DataTable'
import { PageHeader } from '@/components/inventory/PageHeader'

interface Move { id:number; move_type:string; ref_id:number; delta:number; created_at:string; product:{id:number;name:string;sku:string}; warehouse:{id:number;name:string} }

const TYPE_ICON: Record<string, JSX.Element> = {
  receipt:      <ArrowDownToLine className="w-3.5 h-3.5"/>,
  delivery:     <ArrowUpFromLine className="w-3.5 h-3.5"/>,
  transfer_out: <Shuffle className="w-3.5 h-3.5"/>,
  transfer_in:  <Shuffle className="w-3.5 h-3.5"/>,
  adjustment:   <SlidersHorizontal className="w-3.5 h-3.5"/>,
}
const TYPE_COLOR: Record<string, string> = {
  receipt:      'text-sky-500 bg-sky-500/10',
  delivery:     'text-violet-500 bg-violet-500/10',
  transfer_out: 'text-amber-500 bg-amber-500/10',
  transfer_in:  'text-teal-500 bg-teal-500/10',
  adjustment:   'text-[var(--primary)] bg-[var(--primary)]/10',
}

export default function HistoryPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [moves, setMoves]   = useState<Move[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [fetching, setFetching] = useState(true)
  const limit = 50

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  const load = (p: number) => {
    setFetching(true)
    fetch(`/api/history?page=${p}&limit=${limit}`).then(r=>r.json())
      .then(d => { setMoves(d.moves??[]); setTotal(d.total??0) })
      .finally(() => setFetching(false))
  }
  useEffect(() => { if (user) load(page) }, [user, page])

  const columns: Column<Move>[] = [
    { key:'move_type', header:'Type', render: m => (
      <span className={`badge-base flex items-center gap-1.5 ${TYPE_COLOR[m.move_type] ?? ''}`}>
        {TYPE_ICON[m.move_type]}
        {m.move_type.replace('_', ' ')}
      </span>
    )},
    { key:'product',   header:'Product',   render: m => <div><p className="font-semibold">{m.product?.name}</p><p className="text-xs font-mono text-[var(--muted-foreground)]">{m.product?.sku}</p></div> },
    { key:'warehouse', header:'Warehouse', render: m => m.warehouse?.name },
    { key:'delta',     header:'Δ Qty',     render: m => (
      <span className={`font-bold font-mono ${m.delta > 0 ? 'text-[var(--success)]' : m.delta < 0 ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}`}>
        {m.delta > 0 ? '+' : ''}{m.delta}
      </span>
    )},
    { key:'ref_id',    header:'Ref',       render: m => <span className="text-xs text-[var(--muted-foreground)] font-mono">#{m.ref_id}</span> },
    { key:'created_at',header:'Date',      render: m => new Date(m.created_at).toLocaleString() },
  ]

  if (loading || !user) return null
  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 md:p-8">
      <PageHeader title="Move History" subtitle={`Stock ledger — ${total} total entries.`} />
      <DataTable columns={columns} rows={moves} loading={fetching} keyExtractor={m=>m.id} emptyMessage="No stock movements recorded yet." />
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <button disabled={page<=1} onClick={()=>setPage(p=>p-1)} className="btn-secondary disabled:opacity-40">← Previous</button>
          <span className="text-sm text-[var(--muted-foreground)]">Page {page} of {totalPages}</span>
          <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)} className="btn-secondary disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  )
}
