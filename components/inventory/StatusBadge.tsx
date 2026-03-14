type Status = 'draft' | 'waiting' | 'ready' | 'done' | 'canceled' | 'validated' | 'completed' | string

const MAP: Record<string, string> = {
  draft:     'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  waiting:   'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  ready:     'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  done:      'bg-[var(--success)]/15 text-[var(--success)]',
  canceled:  'bg-[var(--destructive)]/15 text-[var(--destructive)]',
  // legacy
  validated: 'bg-[var(--success)]/15 text-[var(--success)]',
  completed: 'bg-[var(--success)]/15 text-[var(--success)]',
}

const LABEL: Record<string, string> = {
  draft:     'Draft',
  waiting:   'Waiting',
  ready:     'Ready',
  done:      'Done',
  canceled:  'Canceled',
  validated: 'Validated',
  completed: 'Completed',
}

export function StatusBadge({ status }: { status: Status }) {
  const cls   = MAP[status]   ?? 'bg-[var(--muted)] text-[var(--muted-foreground)]'
  const label = LABEL[status] ?? (status.charAt(0).toUpperCase() + status.slice(1))
  return (
    <span className={`badge-base ${cls}`}>
      {label}
    </span>
  )
}
