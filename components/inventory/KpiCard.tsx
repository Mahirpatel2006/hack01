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
    <div className={`card-base hover:-translate-y-1 hover:shadow-lg transition-all cursor-default
      ${alert ? 'border-[var(--destructive)]/40 bg-gradient-to-br from-[var(--destructive)]/10 to-transparent' : 'bg-gradient-to-br from-[var(--card)] to-[var(--muted)]/20'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-2 md:mb-3">{label}</p>
          <p className={`text-2xl md:text-4xl font-black tracking-tight ${color}`}>{value}</p>
        </div>
        <div className={`text-[var(--muted-foreground)] opacity-20 ${color} transition-transform group-hover:scale-110 group-hover:opacity-30`}>
          <div className="w-10 h-10 md:w-14 md:h-14">{icon}</div>
        </div>
      </div>
    </div>
  )
}
