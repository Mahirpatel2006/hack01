'use client'
import { useState, useEffect } from 'react'

interface AuthUser {
  id: string
  email: string
  full_name: string
  role: string
  avatar_url?: string | null
  created_at: string
}

interface UseAuthReturn {
  user: AuthUser | null
  loading: boolean
  isOwner: boolean
  isManager: boolean
  isStaff: boolean
  isAuthenticated: boolean
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!cancelled) setUser(data?.user ?? null)
      })
      .catch(() => { if (!cancelled) setUser(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  return {
    user,
    loading,
    isOwner:  user?.role === 'owner',
    isManager: user?.role === 'manager' || user?.role === 'owner',
    isStaff: user?.role === 'staff',
    isAuthenticated: !!user,
  }
}
