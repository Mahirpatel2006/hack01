'use client'
import React from 'react'
import { ChevronDown } from 'lucide-react'

export interface SelectOption { value: string | number; label: string; disabled?: boolean }

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[]; placeholder?: string; label?: string; error?: string; helpText?: string; wrapperClassName?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder, label, error, helpText, wrapperClassName = '', id, className = '', ...props }, ref
) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)
  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && <label htmlFor={inputId} className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">{label}</label>}
      <div className="relative">
        <select id={inputId} ref={ref} className={`input-base appearance-none pr-10 cursor-pointer ${error ? 'border-[var(--destructive)]' : ''} ${className}`} {...props}>
          {placeholder && <option value="" disabled>{placeholder}</option>}
          {options.map(opt => <option key={opt.value} value={opt.value} disabled={opt.disabled}>{opt.label}</option>)}
        </select>
        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)] pointer-events-none" />
      </div>
      {helpText && !error && <p className="text-xs text-[var(--muted-foreground)]">{helpText}</p>}
      {error && <p className="text-xs text-[var(--destructive)] font-semibold">{error}</p>}
    </div>
  )
})
