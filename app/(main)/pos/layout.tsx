'use client'

import { MainLayout } from '@/components/layout/main-layout'

export default function POSLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <MainLayout>{children}</MainLayout>
}
