import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Navbar }        from '@/components/Navbar'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'CoreInventory — Inventory Management System',
  description: 'A modular inventory management system with real-time stock tracking.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans antialiased min-h-screen bg-[var(--background)]">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Navbar />
          {/* Main content — offset by sidebar width on desktop */}
          <main className="min-h-screen transition-all duration-300
            lg:pl-[240px]
            [&:has(+_*_.sidebar-collapsed)]:lg:pl-[72px]">
            {children}
          </main>
        </ThemeProvider>
      </body>
    </html>
  )
}
