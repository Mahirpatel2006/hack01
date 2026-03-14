import { type ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-[var(--foreground)] tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm md:text-base text-[var(--muted-foreground)] font-medium mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 w-full sm:w-auto flex sm:block">{action}</div>}
    </div>
  )
}
