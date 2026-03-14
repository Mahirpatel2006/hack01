interface Props {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'ghost'
}

export function Card({ children, className, variant = 'default' }: Props) {
  const variants = {
    default: 'shadow-sm',
    elevated: 'shadow-xl shadow-black/5 dark:shadow-black/20 hover:-translate-y-1',
    ghost: 'bg-transparent border-dashed',
  }

  return (
    <div className={`card-base ${variants[variant]} ${className ?? ''}`}>
      {children}
    </div>
  )
}
