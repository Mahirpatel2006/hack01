import { type ReactNode } from 'react'
import { Loader2, Inbox } from 'lucide-react'

export interface Column<T> {
  key: keyof T | string
  header: string
  render?: (row: T) => ReactNode
  className?: string
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  keyExtractor: (row: T) => string | number
}

export function DataTable<T>({
  columns, rows, loading, emptyMessage = 'No records found.', onRowClick, keyExtractor
}: Props<T>) {
  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--card)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] bg-[var(--muted)]/40">
            {columns.map(c => (
              <th
                key={c.key as string}
                className={`text-left px-5 py-3.5 text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-16 text-[var(--muted-foreground)]">
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Loading…</span>
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-16 text-[var(--muted-foreground)]">
                <div className="flex flex-col items-center gap-3">
                  <Inbox className="w-10 h-10 opacity-30" />
                  <p className="font-medium text-sm">{emptyMessage}</p>
                </div>
              </td>
            </tr>
          ) : (
            rows.map(row => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-[var(--border)] last:border-0 transition-colors
                  ${onRowClick ? 'cursor-pointer hover:bg-[var(--muted)]/50' : ''}`}
              >
                {columns.map(c => (
                  <td key={c.key as string} className={`px-5 py-4 text-[var(--foreground)] ${c.className ?? ''}`}>
                    {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key as string] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
