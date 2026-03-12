'use client'

import { Suspense } from 'react'
import { RestoOrderContent } from '@/components/pos/resto-order-content'

export default function RestoOrderPage() {
  return (
    <Suspense
      fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}
    >
      <RestoOrderContent unitId={2} unitName="AXL Resto" />
    </Suspense>
  )
}
