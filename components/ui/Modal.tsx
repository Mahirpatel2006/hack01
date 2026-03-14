'use client'
import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  description?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showClose?: boolean
}

const SIZE_MAP = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }

export function Modal({ open, onClose, title, description, children, size = 'md', showClose = true }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div ref={overlayRef} className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className={`relative z-10 w-full ${SIZE_MAP[size]} max-h-[90vh] overflow-y-auto bg-[var(--card)] rounded-[2rem] border border-[var(--border)] shadow-2xl`}>
        {(title || showClose) && (
          <div className="flex items-start justify-between gap-4 p-6 pb-0">
            <div>
              {title && <h2 id="modal-title" className="text-xl font-black text-[var(--foreground)]">{title}</h2>}
              {description && <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>}
            </div>
            {showClose && (
              <button onClick={onClose} className="shrink-0 p-2 rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition-colors" aria-label="Close modal">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

interface ConfirmProps {
  open: boolean; onConfirm: () => void; onCancel: () => void
  title?: string; message?: string; confirmLabel?: string; cancelLabel?: string; variant?: 'danger' | 'primary'
}

export function ConfirmDialog({ open, onConfirm, onCancel, title = 'Are you sure?', message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger' }: ConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      {message && <p className="text-sm text-[var(--muted-foreground)] mb-6">{message}</p>}
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-outline flex-1">{cancelLabel}</button>
        <button onClick={onConfirm} className={`flex-1 ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}>{confirmLabel}</button>
      </div>
    </Modal>
  )
}
