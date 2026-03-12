'use client'

import { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { cn } from '@/lib/utils'

export function MainLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  const isInvoicePage = pathname?.startsWith('/report/invoice')

  return (
    <div className="bg-muted flex min-h-screen w-full">
      {!isInvoicePage && <Sidebar />}
      <div className={cn('flex-1 transition-all duration-300', !isInvoicePage && 'pl-64')}>
        {children}
      </div>
    </div>
  )
}
