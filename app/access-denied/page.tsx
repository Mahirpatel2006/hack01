'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldOff, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { Button }  from '@/components/ui/Button'

export default function AccessDeniedPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-base max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-[var(--destructive)]/10 flex items-center justify-center mx-auto mb-6">
          <ShieldOff className="w-8 h-8 text-[var(--destructive)]" />
        </div>
        <h1 className="text-2xl font-black text-[var(--foreground)] mb-2">Access Denied</h1>
        <p className="text-[var(--muted-foreground)] mb-8">You don&apos;t have permission to view this page. Contact your manager for access.</p>
        <Link href="/dashboard">
          <Button variant="secondary" className="w-full"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}
