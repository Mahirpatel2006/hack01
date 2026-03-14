'use client'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-[var(--muted)] ${className}`} aria-hidden="true" />
}

export function KpiSkeleton() {
  return (
    <div className="card-base flex flex-col gap-3">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <Skeleton className="h-6 w-12 rounded-lg" />
      <Skeleton className="h-3 w-20 rounded-lg" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-4 w-full rounded-lg" />)}
      </div>
      {Array.from({ length: rows }).map((_, ri) => (
        <div key={ri} className="grid gap-4 p-4 rounded-xl bg-[var(--muted)]/30" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, ci) => <Skeleton key={ci} className="h-4 w-full rounded-lg" />)}
        </div>
      ))}
    </div>
  )
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ))}
      <Skeleton className="h-12 w-full rounded-full mt-4" />
    </div>
  )
}
