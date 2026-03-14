'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCircle, Save, Key } from 'lucide-react'
import { useAuth }   from '@/hooks/useAuth'
import { PageHeader } from '@/components/inventory/PageHeader'
import { Button }    from '@/components/ui/Button'
import { Input }     from '@/components/ui/Input'
import { Alert }     from '@/components/ui/Alert'

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [pwForm, setPwForm] = useState({ currentPassword:'', newPassword:'', confirmPassword:'' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{type:'success'|'error', text:string}|null>(null)

  useEffect(() => { if (!loading && !user) router.push('/login') }, [user, loading, router])

  async function handleChangePassword() {
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setMsg({ type:'error', text:'New passwords do not match.' }); return
    }
    setSaving(true); setMsg(null)
    const res = await fetch('/api/auth/change-password', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword })
    })
    const data = await res.json()
    if (!res.ok) { setMsg({ type:'error', text: data.error }); setSaving(false); return }
    setMsg({ type:'success', text:'Password changed successfully.' })
    setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' })
    setSaving(false)
  }

  if (loading || !user) return null

  return (
    <div className="p-6 md:p-8 max-w-2xl">
      <PageHeader title="My Profile" subtitle="Manage your account settings." />
      <div className="space-y-6">
        {/* Info card */}
        <div className="card-base">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-[var(--muted)] flex items-center justify-center font-black text-2xl text-[var(--foreground)] shrink-0">
              {user.full_name.slice(0,2).toUpperCase()}
            </div>
            <div>
              <p className="text-xl font-black text-[var(--foreground)]">{user.full_name}</p>
              <p className="text-[var(--muted-foreground)]">{user.email}</p>
              <span className={`badge-base mt-2 inline-block ${user.role === 'manager' ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-[var(--success)]/15 text-[var(--success)]'}`}>
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </span>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="card-base">
          <div className="flex items-center gap-2 mb-6">
            <Key className="w-5 h-5 text-[var(--primary)]" />
            <h2 className="text-lg font-black text-[var(--foreground)]">Change Password</h2>
          </div>
          <div className="space-y-4">
            <Input type="password" label="Current Password" value={pwForm.currentPassword} onChange={e=>setPwForm(f=>({...f,currentPassword:e.target.value}))} autoComplete="current-password" />
            <Input type="password" label="New Password" value={pwForm.newPassword} onChange={e=>setPwForm(f=>({...f,newPassword:e.target.value}))} autoComplete="new-password" />
            <Input type="password" label="Confirm New Password" value={pwForm.confirmPassword} onChange={e=>setPwForm(f=>({...f,confirmPassword:e.target.value}))} autoComplete="new-password" />
            {msg && <Alert type={msg.type}>{msg.text}</Alert>}
            <Button onClick={handleChangePassword} loading={saving}><Save className="w-4 h-4"/> Update Password</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
