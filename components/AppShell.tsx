'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useState, useEffect } from 'react'
import {
  Zap, LayoutDashboard, PackageSearch, ArrowDownToLine, ArrowUpFromLine,
  Shuffle, SlidersHorizontal, History, Warehouse, UserCircle,
  LogOut, ChevronLeft, ChevronRight, Loader2, Menu, X, ShieldCheck
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const { user, loading, isManager, isOwner } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

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
  
  if (isAuthPage) {
    return <main className="min-h-screen">{children}</main>
  }

  return (
    <div className="min-h-screen bg-(--background) flex flex-col md:flex-row">
      {/* Mobile Topbar */}
      <header className="md:hidden flex items-center justify-between h-16 px-4 border-b border-(--border) bg-(--card) sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-(--primary) flex items-center justify-center shadow-(--primary)/30">
            <Zap className="w-4 h-4 text-white fill-current" />
          </div>
          <span className="font-black text-(--foreground)">CoreInventory</span>
        </div>
        <button 
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-xl text-(--foreground) hover:bg-(--muted) transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen z-50 flex flex-col border-r border-(--border)
          bg-(--card) transition-all duration-300 transform 
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-[80px]' : 'md:w-[260px] w-64'}`}
      >
        {/* Mobile close button inside sidebar header */}
        <div className={`flex items-center gap-3 px-4 h-20 border-b border-(--border) shrink-0 
            ${collapsed ? 'md:justify-center' : 'justify-between md:justify-start'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-(--primary) flex items-center justify-center shadow-lg shadow-(--primary)/30 shrink-0">
              <Zap className="w-5 h-5 text-white fill-current" />
            </div>
            {!collapsed && (
              <div className="max-w-[140px]">
                <p className="text-sm font-black tracking-tight text-(--foreground) truncate">CoreInventory</p>
                <p className="text-[10px] font-semibold text-(--primary) uppercase tracking-widest">by HackBase</p>
              </div>
            )}
          </div>
          {/* Mobile close */}
          <button 
            className="md:hidden p-2 rounded-xl hover:bg-(--muted)"
            onClick={() => setMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-5 px-3 space-y-1.5 scrollbar-thin">
          {loading ? (
             <div className="flex justify-center pt-8"><Loader2 className="w-6 h-6 animate-spin text-(--muted-foreground)" /></div>
          ) : visibleNav.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/')
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold transition-all group relative overflow-hidden
                    ${active
                      ? 'bg-(--primary) text-white shadow-md shadow-(--primary)/20'
                      : 'text-(--muted-foreground) hover:bg-(--muted) hover:text-(--foreground)'
                    } ${collapsed ? 'md:justify-center' : ''}`}
                  title={collapsed ? label : undefined}
                >
                  <Icon className={`w-[22px] h-[22px] shrink-0 ${active && !collapsed ? 'animate-pulse' : ''}`} />
                  {/* The span wrapper solves truncation for long labels */}
                  <span className={`${collapsed ? 'md:hidden' : 'block'} whitespace-nowrap`}>
                    {label}
                  </span>
                </Link>
              )
            })
          }
        </nav>

        {/* Footer */}
        <div className="border-t border-(--border) p-4 pb-8 md:pb-10 space-y-3 shrink-0 bg-(--card) shadow-[0_-10px_10px_-10px_rgba(0,0,0,0.05)]">
          {!loading && user && (
            <Link href="/profile"
              className={`flex items-center gap-3 px-2 py-2.5 rounded-[1.25rem] hover:bg-(--muted) transition-colors 
                ${collapsed ? 'md:justify-center' : ''}`}
            >
              <div className="w-9 h-9 rounded-full bg-linear-to-br from-(--primary) to-amber-500 text-white flex flex-col items-center justify-center font-bold text-sm shrink-0 shadow-lg shadow-brand-orange/20 overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  user.full_name.slice(0, 2).toUpperCase()
                )}
              </div>
              <div className={`${collapsed ? 'md:hidden' : 'block'} flex-1 min-w-0`}>
                <p className="text-sm font-bold text-(--foreground) truncate">{user.full_name}</p>
                <p className="text-[10px] text-(--primary) font-semibold uppercase tracking-widest">{user.role}</p>
              </div>
            </Link>
          )}

          <div className={`flex items-center gap-2 ${collapsed ? 'md:flex-col' : ''}`}>
            <ThemeToggle />
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-[1.25rem] text-sm font-bold transition-all
                ${collapsed ? 'md:w-full md:px-0 bg-(--muted) text-(--muted-foreground) hover:text-white' : 'flex-1 px-4'}
                text-(--muted-foreground) hover:bg-(--destructive) hover:text-white hover:shadow-lg hover:shadow-red-500/20`}
              title="Sign out"
            >
              {loggingOut ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <LogOut className="w-[18px] h-[18px]" />}
              <span className={collapsed ? 'md:hidden' : 'block'}>Sign out</span>
            </button>
          </div>

          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden md:flex w-full items-center justify-center py-2 rounded-xl text-(--muted-foreground) hover:bg-(--muted) hover:text-(--foreground) transition-colors"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          > Collapse
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col min-h-screen transition-all duration-300">
        <div className="flex-1 w-full max-w-[1600px] mx-auto overflow-hidden relative pb-10">
           {children}
        </div>
      </main>
    </div>
  )
}
