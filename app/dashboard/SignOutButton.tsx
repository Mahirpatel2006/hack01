'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function SignOutButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      router.push('/login')
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleSignOut}
      loading={loading}
      icon={!loading && <LogOut className="w-4 h-4" />}
      className="px-4 py-2 text-sm border-[var(--border)] hover:bg-[var(--destructive)] hover:text-white transition-all shadow-sm"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </Button>
  )
}
