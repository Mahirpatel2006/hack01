import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider }  from '@/components/ThemeProvider'
import { AppShell }     from '@/components/AppShell'
import { ToastProvider }  from '@/components/ui/Toast'
import { ErrorBoundary }  from '@/components/ui/ErrorBoundary'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'CoreInventory — Inventory Management System',
  description: 'A modular, real-time inventory management system with role-based access control.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'),
  openGraph: {
    title: 'CoreInventory',
    description: 'Real-time inventory management with receipts, deliveries, transfers, and audit logs.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased min-h-screen bg-[var(--background)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ToastProvider>
            <ErrorBoundary>
              <AppShell>
                {children}
              </AppShell>
            </ErrorBoundary>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
