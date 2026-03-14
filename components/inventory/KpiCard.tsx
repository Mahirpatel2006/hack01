import { type ReactNode } from 'react'

interface Props {
  icon: ReactNode
  label: string
  value: number | string
  /** Tailwind color token, e.g. 'text-[var(--primary)]' */
  color?: string
  alert?: boolean
}

export function KpiCard({ icon, label, value, color = 'text-[var(--primary)]', alert }: Props) {
  return (
    <div className={`card-base hover:-translate-y-1 transition-all cursor-default
      ${alert ? 'border-[var(--destructive)]/30 bg-[var(--destructive)]/5' : ''}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">{label}</p>
          <p className={`text-4xl font-black ${color}`}>{value}</p>
        </div>
        <div className={`text-[var(--muted-foreground)] opacity-20 ${color}`}>
          <div className="w-14 h-14">{icon}</div>
        </div>
      </div>
    </div>
  )
}
