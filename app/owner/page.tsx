'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShieldCheck, UserPlus, Trash2, Zap } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'

interface Manager {
  id: string
  email: string
  full_name: string
  created_at: string
}

export default function OwnerPage() {
  const { user, loading, isOwner } = useAuth()
  const router = useRouter()

  const [managers, setManagers] = useState<Manager[]>([])
  const [fetching, setFetching] = useState(false)

  // Form state
  const [fullName, setFullName] = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]   = useState('')
  const [success, setSuccess] = useState('')

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.push('/login')
    if (!loading && user && !isOwner) router.push('/access-denied')
  }, [user, loading, isOwner, router])

  // Fetch managers
  useEffect(() => {
    if (!isOwner) return
    setFetching(true)
    fetch('/api/auth/managers')
      .then(r => r.json())
      .then(d => setManagers(d.managers ?? []))
      .catch(() => {})
      .finally(() => setFetching(false))
  }, [isOwner])

  async function handleAddManager(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/add-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add manager.')
        return
      }
      setSuccess(`Manager "${data.manager.full_name}" created successfully!`)
      setManagers(prev => [data.manager, ...prev])
      setFullName('')
      setEmail('')
      setPassword('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !user) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-(--muted-foreground) text-sm font-medium animate-pulse">Loading…</div>
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-(--primary) flex items-center justify-center shadow-lg shadow-(--primary)/30">
          <ShieldCheck className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-(--foreground) tracking-tight">Owner Panel</h1>
          <p className="text-xs text-(--muted-foreground) font-semibold uppercase tracking-widest">Manage Managers</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add Manager Form */}
        <div className="card-base">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus className="w-5 h-5 text-(--primary)" />
            <h2 className="text-lg font-black text-(--foreground)">Add New Manager</h2>
          </div>

          {error && <div className="mb-4"><Alert type="error">{error}</Alert></div>}
          {success && <div className="mb-4"><Alert type="success">{success}</Alert></div>}

          <form onSubmit={handleAddManager} className="space-y-4">
            <Input
              id="manager_full_name"
              label="Full name"
              type="text"
              placeholder="Jane Smith"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
            />
            <Input
              id="manager_email"
              label="Email address"
              type="email"
              placeholder="manager@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <Input
              id="manager_password"
              label="Password"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <Button type="submit" loading={submitting} className="w-full mt-2">
              {submitting ? 'Creating…' : 'Create Manager Account'}
            </Button>
          </form>
        </div>

        {/* Managers List */}
        <div className="card-base">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-(--primary)" />
            <h2 className="text-lg font-black text-(--foreground)">Existing Managers</h2>
          </div>

          {fetching ? (
            <div className="text-center py-8 text-(--muted-foreground) text-sm animate-pulse">Loading…</div>
          ) : managers.length === 0 ? (
            <div className="text-center py-12">
              <Zap className="w-10 h-10 mx-auto mb-3 text-(--muted-foreground) opacity-30" />
              <p className="text-(--muted-foreground) text-sm">No managers yet. Create the first one!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {managers.map(m => (
                <li key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-(--muted)/40 hover:bg-(--muted) transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-(--primary)/15 flex items-center justify-center font-bold text-sm text-(--primary) shrink-0">
                    {m.full_name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-(--foreground) truncate">{m.full_name}</p>
                    <p className="text-xs text-(--muted-foreground) truncate">{m.email}</p>
                  </div>
                  <span className="badge-base bg-(--primary)/10 text-(--primary) text-[10px] shrink-0">
                    Manager
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Back link */}
      <div className="mt-8">
        <Link href="/dashboard" className="text-sm font-semibold text-(--primary) hover:underline underline-offset-4">
          ← Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
