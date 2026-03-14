'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import {
  Zap, LayoutDashboard, PackageSearch, ArrowDownToLine, ArrowUpFromLine,
  Shuffle, SlidersHorizontal, History, Warehouse, UserCircle,
  LogOut, ChevronLeft, ChevronRight, Loader2, ShieldCheck
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { ThemeToggle } from '@/components/ThemeToggle'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',       icon: LayoutDashboard,    managerOnly: false, ownerOnly: false },
  { href: '/product',      label: 'Products',        icon: PackageSearch,       managerOnly: true,  ownerOnly: false },
  { href: '/receipts',     label: 'Receipts',        icon: ArrowDownToLine,     managerOnly: false, ownerOnly: false },
  { href: '/deliveries',   label: 'Deliveries',      icon: ArrowUpFromLine,     managerOnly: false, ownerOnly: false },
  { href: '/transfers',    label: 'Transfers',       icon: Shuffle,             managerOnly: false, ownerOnly: false },
  { href: '/adjustments',  label: 'Adjustments',     icon: SlidersHorizontal,   managerOnly: false, ownerOnly: false },
  { href: '/history',      label: 'Move History',    icon: History,             managerOnly: false, ownerOnly: false },
  { href: '/warehouses',   label: 'Warehouses',      icon: Warehouse,           managerOnly: true,  ownerOnly: false },
  { href: '/owner',        label: 'Manage Managers', icon: ShieldCheck,         managerOnly: false, ownerOnly: true  },
]

export function Navbar() {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, loading, isManager, isOwner } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const visibleNav = NAV.filter(n => {
    if (n.ownerOnly) return isOwner
    if (n.managerOnly) return isManager
    return true
  })

  async function handleLogout() {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const isAuthPage = ['/login', '/register', '/reset-password'].some(p => pathname.startsWith(p))
  if (isAuthPage) return null

  return (
    <aside
      className={`fixed left-0 top-0 h-full z-40 flex flex-col border-r border-[var(--border)]
        bg-[var(--card)] transition-all duration-300 ${collapsed ? 'w-[72px]' : 'w-[240px]'}`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-20 border-b border-[var(--border)] shrink-0 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-[var(--primary)] flex items-center justify-center shadow-lg shadow-[var(--primary)]/30 shrink-0">
          <Zap className="w-5 h-5 text-white fill-current" />
        </div>
        {!collapsed && (
          <div>
            <p className="text-sm font-black tracking-tight text-[var(--foreground)]">CoreInventory</p>
            <p className="text-[10px] font-semibold text-[var(--primary)] uppercase tracking-widest">by HackBase</p>
          </div>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        {loading
          ? <div className="flex justify-center pt-4"><Loader2 className="w-5 h-5 animate-spin text-[var(--muted-foreground)]" /></div>
          : visibleNav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group
                  ${active
                    ? 'bg-[var(--primary)] text-white shadow-md shadow-[var(--primary)]/20'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]'
                  } ${collapsed ? 'justify-center' : ''}`}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </Link>
            )
          })
        }
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--border)] p-3 space-y-2 shrink-0">
        {/* User tile */}
        {!loading && user && (
          <Link href="/profile"
            className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-[var(--muted)] transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center font-bold text-sm text-[var(--foreground)] shrink-0">
              {user.full_name.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--foreground)] truncate">{user.full_name}</p>
                <p className="text-[10px] text-[var(--primary)] font-semibold uppercase tracking-wider">{user.role}</p>
              </div>
            )}
          </Link>
        )}

        {/* Bottom actions row */}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <ThemeToggle />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold
              text-[var(--muted-foreground)] hover:bg-[var(--destructive)] hover:text-white transition-all"
            title="Sign out"
          >
            {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="w-full flex items-center justify-center py-1.5 rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  )
}
