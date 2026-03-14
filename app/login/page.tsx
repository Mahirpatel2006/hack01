'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ThemeToggle } from '@/components/ThemeToggle'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Login failed.')
        return
      }

      router.push('/dashboard')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page relative">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <div className="card-base max-w-md w-full relative overflow-hidden z-10">
        {/* Decorative corner blur */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--primary)] rounded-full blur-[80px] opacity-20 pointer-events-none" />

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] shadow-lg shadow-[var(--primary)]/30 flex items-center justify-center text-white">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <span className="text-2xl font-black text-[var(--foreground)] tracking-tight">HackBase</span>
        </div>

        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">Welcome back</h1>
        <p className="text-[var(--muted-foreground)] text-sm mb-8">Sign in to your account to continue</p>

        {error && (
          <div className="mb-6">
            <Alert type="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            icon={<Mail className="w-5 h-5" />}
            required
          />

          <Input
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            icon={<Lock className="w-5 h-5" />}
            required
          />

          <div className="flex justify-end pt-1">
            <Link
              href="/reset-password"
              className="text-xs font-semibold text-[var(--primary)] hover:opacity-80 transition-opacity"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} icon={!loading && <LogIn className="w-4 h-4" />} className="w-full mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm font-medium text-[var(--muted-foreground)]">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[var(--primary)] hover:underline underline-offset-4 font-bold transition-all">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
