'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Zap, Mail, Lock, KeyRound, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { ThemeToggle } from '@/components/ThemeToggle'

type Step = 1 | 2

export default function ResetPasswordPage() {
  const router  = useRouter()
  const [step, setStep]           = useState<Step>(1)
  const [email, setEmail]         = useState('')
  const [otp, setOtp]             = useState('')
  const [otpDisplay, setOtpDisplay] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send code.')
        return
      }
      setOtpDisplay(data.otp ?? null)
      setStep(2)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Verification failed.')
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
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-[var(--primary)] rounded-full blur-[80px] opacity-20 pointer-events-none" />

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[var(--primary)] shadow-lg shadow-[var(--primary)]/30 flex items-center justify-center text-white">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="text-2xl font-black text-[var(--foreground)] tracking-tight">HackBase</span>
          </div>
          
          <div className="flex gap-1.5 items-center bg-[var(--muted)] px-3 py-1.5 rounded-full">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 1 ? 'bg-[var(--primary)]' : 'bg-[var(--muted-foreground)]'}`} />
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${step >= 2 ? 'bg-[var(--primary)]' : 'bg-[var(--muted-foreground)]'}`} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-[var(--foreground)] mb-1">Reset password</h1>
        <p className="text-[var(--muted-foreground)] text-sm mb-8">
          {step === 1 ? 'Enter your email to receive a verification code.' : 'Enter the code and your new password.'}
        </p>

        {error && (
          <div className="mb-6">
            <Alert type="error">{error}</Alert>
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-6">
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
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Sending…' : 'Get verification code'}
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            {otpDisplay && (
              <div className="p-6 rounded-3xl bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-center mb-4 text-[var(--primary)]">
                <p className="text-xs font-bold uppercase tracking-widest mb-2 opacity-80">Test code (Skip Email)</p>
                <p className="font-mono text-4xl font-black tracking-widest">
                  {otpDisplay}
                </p>
              </div>
            )}

            <Input
              id="otp"
              label="Verification code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
              icon={<KeyRound className="w-5 h-5" />}
              required
            />

            <Input
              id="new_password"
              label="New password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              icon={<Lock className="w-5 h-5" />}
              required
            />

            <Button type="submit" loading={loading} className="w-full mt-2">
              {loading ? 'Resetting…' : 'Confirm reset'}
            </Button>

            <button
              type="button"
              onClick={() => { setStep(1); setOtpDisplay(null); setError('') }}
              className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to email
            </button>
          </form>
        )}

        {step === 1 && (
          <p className="mt-8 text-center text-sm font-medium text-[var(--muted-foreground)]">
            Remembered it?{' '}
            <Link href="/login" className="text-[var(--primary)] hover:underline underline-offset-4 font-bold transition-all">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
