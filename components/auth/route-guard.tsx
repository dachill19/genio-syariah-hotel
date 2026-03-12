'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const [authorized, setAuthorized] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) return

    if (!isAuthenticated || !user) {
      router.push('/')
      return
    }

    const isCafeUrl = pathname.includes('/pos/cafe')
    const isRestoUrl = pathname.includes('/pos/restaurant')
    const isManagerUrl = pathname.includes('/manager')

    // Unit Check
    if (user.unit_id === 1 && isRestoUrl) {
      router.replace(user.role === 'MANAGER' ? '/pos/cafe/manager' : '/pos/cafe')
      return
    }
    if (user.unit_id === 2 && isCafeUrl) {
      router.replace(user.role === 'MANAGER' ? '/pos/restaurant/manager' : '/pos/restaurant')
      return
    }

    // Role Check
    if (user.role === 'CASHIER' && isManagerUrl) {
      router.replace(user.unit_id === 1 ? '/pos/cafe' : '/pos/restaurant')
      return
    }
    if (user.role === 'MANAGER' && !isManagerUrl) {
       router.replace(user.unit_id === 1 ? '/pos/cafe/manager' : '/pos/restaurant/manager')
       return
    }

    setAuthorized(true)
  }, [isAuthenticated, user, pathname, router, isMounted])

  if (!isMounted || !authorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return <>{children}</>
}
