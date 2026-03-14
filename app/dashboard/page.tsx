'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Package, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Shuffle, TrendingUp, PackageX } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { KpiCard }    from '@/components/inventory/KpiCard'
import { StatusBadge} from '@/components/inventory/StatusBadge'
import { PageHeader }  from '@/components/inventory/PageHeader'

interface KPIs {
  totalProducts: number
  lowStock: number
  outOfStock: number
  pendingReceipts: number
  pendingDeliveries: number
  scheduledTransfers: number
}
interface Activity { id: string; type: string; description: string; status: string; date: Date }

export default function DashboardPage() {
  const { user, loading, isManager } = useAuth()
  const router = useRouter()
  const [kpis, setKpis] = useState<KPIs>({ totalProducts:0, lowStock:0, outOfStock:0, pendingReceipts:0, pendingDeliveries:0, scheduledTransfers:0 })
  const [activity, setActivity] = useState<Activity[]>([])
  const [fetching, setFetching] = useState(false)

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  useEffect(() => {
    if (!user) return
    setFetching(true)
    Promise.all([
      fetch('/api/product').then(r => r.json()),
      fetch('/api/receipt?status=draft').then(r => r.json()),
      fetch('/api/delivery?status=draft').then(r => r.json()),
      fetch('/api/transfer?status=draft').then(r => r.json()),
    ]).then(([pRes, rRes, dRes, tRes]) => {
      const products   = pRes.products  ?? []
      const receipts   = rRes.receipts  ?? []
      const deliveries = dRes.deliveries ?? []
      const transfers  = tRes.transfers  ?? []

      const low = products.filter((p: {stocks:Array<{quantity:number}>; reorder_qty:number}) => {
        const total = p.stocks?.reduce((s:{quantity:number}, st:{quantity:number}) => ({quantity: s.quantity + st.quantity}), {quantity: 0}).quantity ?? 0
        return total > 0 && total < p.reorder_qty
      }).length
      const out = products.filter((p: {stocks:Array<{quantity:number}>}) => {
        const total = p.stocks?.reduce((s:{quantity:number}, st:{quantity:number}) => ({quantity: s.quantity + st.quantity}), {quantity: 0}).quantity ?? 0
        return total === 0
      }).length

      setKpis({ totalProducts: products.length, lowStock: low, outOfStock: out,
        pendingReceipts: receipts.length, pendingDeliveries: deliveries.length, scheduledTransfers: transfers.length })

      const acts: Activity[] = [
        ...receipts.slice(0, 2).map((r:{id:number;supplier:string;status:string;created_at:string}) => ({
          id: `r-${r.id}`, type: 'Receipt', description: `From ${r.supplier}`, status: r.status, date: new Date(r.created_at)
        })),
        ...deliveries.slice(0, 2).map((d:{id:number;customer:string;status:string;created_at:string}) => ({
          id: `d-${d.id}`, type: 'Delivery', description: `To ${d.customer}`, status: d.status, date: new Date(d.created_at)
        })),
        ...transfers.slice(0, 2).map((t:{id:number;fromWarehouse:{name:string};toWarehouse:{name:string};status:string;created_at:string}) => ({
          id: `t-${t.id}`, type: 'Transfer',
          description: `${t.fromWarehouse?.name} → ${t.toWarehouse?.name}`,
          status: t.status, date: new Date(t.created_at)
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6)

      setActivity(acts)
    }).catch(console.error).finally(() => setFetching(false))
  }, [user])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-[var(--muted-foreground)] text-sm font-medium animate-pulse">Loading dashboard…</div>
    </div>
  )
  if (!user) return null

  return (
    <div className="p-6 md:p-8">
      <PageHeader
        title="Dashboard"
        subtitle={isManager ? 'Manager overview — all inventory operations at a glance.' : 'Your inventory snapshot.'}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-10">
        <KpiCard icon={<Package className="w-full h-full" />}          label="Total Products"       value={kpis.totalProducts}       color="text-[var(--primary)]" />
        <KpiCard icon={<AlertTriangle className="w-full h-full" />}    label="Low Stock"             value={kpis.lowStock}            color="text-amber-500"         alert={kpis.lowStock > 0} />
        <KpiCard icon={<PackageX className="w-full h-full" />}         label="Out of Stock"          value={kpis.outOfStock}          color="text-[var(--destructive)]" alert={kpis.outOfStock > 0} />
        <KpiCard icon={<ArrowDownToLine className="w-full h-full" />}  label="Pending Receipts"     value={kpis.pendingReceipts}     color="text-sky-500" />
        <KpiCard icon={<ArrowUpFromLine className="w-full h-full" />}  label="Pending Deliveries"   value={kpis.pendingDeliveries}   color="text-violet-500" />
        <KpiCard icon={<Shuffle className="w-full h-full" />}          label="Scheduled Transfers"  value={kpis.scheduledTransfers}  color="text-teal-500" />
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card-base">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-black text-[var(--foreground)]">Recent Activity</h2>
          </div>
          {fetching ? (
            <div className="text-center py-10 text-[var(--muted-foreground)] text-sm animate-pulse">Loading…</div>
          ) : activity.length === 0 ? (
            <p className="text-center py-10 text-[var(--muted-foreground)] text-sm">No recent activity. Start by creating a receipt or delivery.</p>
          ) : (
            <div className="space-y-3">
              {activity.map(a => (
                <div key={a.id} className="flex items-center justify-between p-4 rounded-xl bg-[var(--muted)]/40 hover:bg-[var(--muted)] transition-colors">
                  <div>
                    <p className="font-semibold text-sm text-[var(--foreground)]">{a.type}: {a.description}</p>
                    <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{a.date.toLocaleString()}</p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Account info */}
        <div className="card-base">
          <h2 className="text-lg font-black text-[var(--foreground)] mb-6">Account</h2>
          <div className="space-y-5">
            <div>
              <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mb-1">Name</p>
              <p className="font-semibold text-[var(--foreground)]">{user.full_name}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mb-1">Email</p>
              <p className="font-semibold text-[var(--foreground)] break-all">{user.email}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted-foreground)] font-bold uppercase tracking-widest mb-2">Role</p>
              <span className={`badge-base ${isManager ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[var(--success)]/15 text-[var(--success)]'}`}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
