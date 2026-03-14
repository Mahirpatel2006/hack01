type Status = 'draft' | 'validated' | 'completed' | 'cancelled' | string

const MAP: Record<string, string> = {
  draft:     'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  validated: 'bg-[var(--success)]/15 text-[var(--success)]',
  completed: 'bg-[var(--success)]/15 text-[var(--success)]',
  cancelled: 'bg-[var(--destructive)]/15 text-[var(--destructive)]',
}

export function StatusBadge({ status }: { status: Status }) {
  const cls = MAP[status] ?? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
  return (
    <span className={`badge-base ${cls}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
