'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { getHomeRoute, isFinanceRole } from '@/lib/access-control'

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  const getRedirectPath = () => {
    if (!isAuthenticated || !user) {
      return '/'
    }

    const isCafeUrl = pathname.includes('/pos/cafe')
    const isRestoUrl = pathname.includes('/pos/restaurant')
    const isManagerUrl = pathname.includes('/manager')
    const isFinanceUrl = pathname.startsWith('/finance')

    if (isFinanceRole(user.role, user.unit_id ?? null) && !isFinanceUrl) {
      return '/finance'
    }

    if (!isFinanceRole(user.role, user.unit_id ?? null) && isFinanceUrl) {
      return getHomeRoute({ role: user.role, unitId: user.unit_id ?? null })
    }

    if (user.unit_id === 1 && isRestoUrl) {
      return user.role === 'MANAGER' ? '/pos/cafe/manager' : '/pos/cafe'
    }

    if (user.unit_id === 2 && isCafeUrl) {
      return user.role === 'MANAGER' ? '/pos/restaurant/manager' : '/pos/restaurant'
    }

    if (user.role === 'CASHIER' && isManagerUrl) {
      return user.unit_id === 1 ? '/pos/cafe' : '/pos/restaurant'
    }

    if (user.role === 'MANAGER' && !isManagerUrl) {
      return user.unit_id === 1 ? '/pos/cafe/manager' : '/pos/restaurant/manager'
    }

    return null
  }

  const redirectPath = getRedirectPath()

  useEffect(() => {
    if (redirectPath && redirectPath !== pathname) {
      if (redirectPath === '/') {
        router.push(redirectPath)
        return
      }

      router.replace(redirectPath)
    }
  }, [pathname, redirectPath, router])

  if (redirectPath) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return <>{children}</>
}
