'use client'
import { type ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({ variant = 'primary', loading, icon, children, className, ...props }: Props) {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  }

  return (
    <button
      className={`${variants[variant]} flex items-center justify-center gap-2 ${className ?? ''}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0 flex items-center">{icon}</span>
      )}
      <span className="flex items-center gap-2 whitespace-nowrap">{children}</span>
    </button>
  )
}
