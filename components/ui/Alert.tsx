import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

interface Props {
  type: 'error' | 'success' | 'info'
  children: React.ReactNode
  className?: string
}

export function Alert({ type, children, className }: Props) {
  const styles = {
    error: 'bg-[var(--destructive)]/10 text-[var(--destructive)] border-[var(--destructive)]/20',
    success: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
    info: 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20',
  }

  const icons = {
    error: <AlertCircle className="w-5 h-5" />,
    success: <CheckCircle2 className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  }

  return (
    <div className={`flex items-start gap-4 p-4 rounded-2xl border ${styles[type]} ${className ?? ''}`} role="alert">
      <div className="shrink-0 mt-0.5">{icons[type]}</div>
      <div className="text-sm font-medium leading-relaxed">{children}</div>
    </div>
  )
}
