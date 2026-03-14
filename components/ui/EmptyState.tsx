'use client'
import React from 'react'

interface EmptyStateProps {
  title: string; message?: string; icon?: React.ReactNode
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ title, message, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4 text-[var(--muted-foreground)]">{icon}</div>}
      <h3 className="text-base font-bold text-[var(--foreground)] mb-1">{title}</h3>
      {message && <p className="text-sm text-[var(--muted-foreground)] max-w-xs">{message}</p>}
      {action && <button onClick={action.onClick} className="btn-primary mt-6">{action.label}</button>}
    </div>
  )
}
