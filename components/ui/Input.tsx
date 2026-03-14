import { type InputHTMLAttributes, forwardRef } from 'react'
import { AlertCircle } from 'lucide-react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  icon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, icon, id, className, ...props }, ref) => (
    <div className="space-y-2 w-full">
      <label htmlFor={id} className="text-sm font-semibold text-[var(--foreground)] ml-1 block">
        {label}
      </label>
      <div className="relative group flex items-center">
        {icon && (
          <div className="absolute left-4 text-[var(--muted-foreground)] group-focus-within:text-[var(--primary)] transition-colors pointer-events-none">
            {icon}
          </div>
        )}
        <input
          id={id}
          ref={ref}
          className={`input-base ${icon ? 'pl-12' : ''} ${error ? 'border-[var(--destructive)] focus:ring-[var(--destructive)]' : ''} ${className ?? ''}`}
          {...props}
        />
        {error && (
          <div className="absolute right-4 text-[var(--destructive)] pointer-events-none">
            <AlertCircle className="w-5 h-5" />
          </div>
        )}
      </div>
      {error && <p className="text-sm font-medium text-[var(--destructive)] ml-1">{error}</p>}
    </div>
  )
)
Input.displayName = 'Input'
