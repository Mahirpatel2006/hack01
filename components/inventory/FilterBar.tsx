import { Search, X, Filter } from 'lucide-react'
import { Select, type SelectOption } from '@/components/ui/Select'

export interface FilterConfig {
  key: string
  label: string
  options: SelectOption[]
  value: string
  onChange: (val: string) => void
}

interface Props {
  searchQuery?: string
  onSearchChange?: (val: string) => void
  searchPlaceholder?: string
  filters?: FilterConfig[]
  onClearFilters?: () => void
  hasActiveFilters?: boolean
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
  onClearFilters,
  hasActiveFilters
}: Props) {
  return (
    <div className="flex flex-col md:flex-row gap-4 mb-6 bg-(--card) p-4 rounded-2xl border border-(--border) items-end">
      {onSearchChange !== undefined && (
        <div className="flex-1 w-full">
          <label className="text-xs font-bold uppercase tracking-widest text-(--muted-foreground) mb-1.5 block">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-(--muted-foreground) pointer-events-none" />
            <input
              type="text"
              value={searchQuery ?? ''}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="input-base pl-10 w-full"
            />
          </div>
        </div>
      )}

      {filters.length > 0 && (
        <div className="flex flex-1 flex-wrap items-center gap-3 w-full md:w-auto">
          {filters.map(filter => (
            <div key={filter.key} className="flex-1 min-w-[140px] md:flex-none md:w-48">
              <Select
                label={filter.label}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                options={filter.options}
                className="w-full"
              />
            </div>
          ))}
        </div>
      )}

      {hasActiveFilters && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="flex items-center justify-center gap-1.5 text-xs font-semibold text-(--muted-foreground) hover:text-(--foreground) transition-colors h-10 px-4 rounded-lg hover:bg-(--muted) w-full md:w-auto"
        >
          <X className="w-4 h-4" /> Clear
        </button>
      )}
    </div>
  )
}
