'use client'
import React, { useRef } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  title: string
  message?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastContextValue {
  show: (opts: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error:   (title: string, message?: string) => void
  warning: (title: string, message?: string) => void
  info:    (title: string, message?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const idCounter = useRef(0)

  const show = React.useCallback((opts: Omit<Toast, 'id'>) => {
    const id = String(++idCounter.current)
    const toast: Toast = { id, duration: 4000, variant: 'info', ...opts }
    setToasts(prev => [...prev, toast])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, toast.duration)
  }, [])

  const success = React.useCallback((title: string, message?: string) => show({ title, message, variant: 'success' }), [show])
  const error   = React.useCallback((title: string, message?: string) => show({ title, message, variant: 'error', duration: 6000 }), [show])
  const warning = React.useCallback((title: string, message?: string) => show({ title, message, variant: 'warning' }), [show])
  const info    = React.useCallback((title: string, message?: string) => show({ title, message, variant: 'info' }), [show])

  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id))

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info }}>
      {children}
      <div aria-live="assertive" className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  )
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: 'bg-emerald-500 text-white',
  error:   'bg-[var(--destructive)] text-white',
  warning: 'bg-amber-500 text-white',
  info:    'bg-[var(--primary)] text-white',
}
const VARIANT_ICONS: Record<ToastVariant, string> = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' }

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const variant = toast.variant ?? 'info'
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-2xl p-4 shadow-lg ${VARIANT_STYLES[variant]}`}>
      <span className="text-lg font-bold shrink-0 leading-none">{VARIANT_ICONS[variant]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">{toast.title}</p>
        {toast.message && <p className="text-xs opacity-90 mt-0.5">{toast.message}</p>}
      </div>
      <button onClick={() => onDismiss(toast.id)} className="shrink-0 opacity-70 hover:opacity-100 transition-opacity text-sm leading-none" aria-label="Dismiss">✕</button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
