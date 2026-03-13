'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Coffee,
  FileText,
  User as UserIcon,
  LogOut,
  Utensils,
  ClipboardList,
  LayoutDashboard,
  UtensilsCrossed,
  History as HistoryIcon,
  ShieldAlert,
  PiggyBank,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Image from 'next/image'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const isCashier = user?.role === 'CASHIER'
  const isManager = user?.role === 'MANAGER'
  const isCafe = user?.unit_id === 1
  const isResto = user?.unit_id === 2

  const links = [
    // CASHIER — Cafe
    {
      href: '/pos/cafe',
      icon: Coffee,
      label: 'Cafe POS',
      hidden: !(isCashier && isCafe),
    },
    {
      href: '/pos/cafe/orders',
      icon: ClipboardList,
      label: 'Cafe Orders',
      hidden: !(isCashier && isCafe),
    },
    {
      href: '/pos/cafe/report',
      icon: FileText,
      label: 'Cafe Report',
      hidden: !(isCashier && isCafe),
    },

    // CASHIER — Resto
    {
      href: '/pos/restaurant',
      icon: Utensils,
      label: 'Resto POS',
      hidden: !(isCashier && isResto),
    },
    {
      href: '/pos/restaurant/orders',
      icon: ClipboardList,
      label: 'Resto Orders',
      hidden: !(isCashier && isResto),
    },
    {
      href: '/pos/restaurant/report',
      icon: FileText,
      label: 'Resto Report',
      hidden: !(isCashier && isResto),
    },

    // MANAGER — Cafe
    {
      href: '/pos/cafe/manager',
      icon: LayoutDashboard,
      label: 'Cafe Dashboard',
      hidden: !(isManager && isCafe),
    },
    {
      href: '/pos/cafe/manager/history',
      icon: HistoryIcon,
      label: 'Cafe History',
      hidden: !(isManager && isCafe),
    },
    {
      href: '/pos/cafe/manager/menu',
      icon: UtensilsCrossed,
      label: 'Cafe Menu',
      hidden: !(isManager && isCafe),
    },
    {
      href: '/pos/cafe/manager/petty-cash',
      icon: PiggyBank,
      label: 'Cafe Petty Cash',
      hidden: !(isManager && isCafe),
    },

    // MANAGER — Resto
    {
      href: '/pos/restaurant/manager',
      icon: LayoutDashboard,
      label: 'Resto Dashboard',
      hidden: !(isManager && isResto),
    },
    {
      href: '/pos/restaurant/manager/history',
      icon: HistoryIcon,
      label: 'Resto History',
      hidden: !(isManager && isResto),
    },
    {
      href: '/pos/restaurant/manager/menu',
      icon: UtensilsCrossed,
      label: 'Resto Menu',
      hidden: !(isManager && isResto),
    },
    {
      href: '/pos/restaurant/manager/petty-cash',
      icon: PiggyBank,
      label: 'Resto Petty Cash',
      hidden: !(isManager && isResto),
    },
    {
      href: '/pos/restaurant/manager/cancels',
      icon: ShieldAlert,
      label: 'Resto Requests',
      hidden: !(isManager && isResto),
    },
  ].filter((link) => !link.hidden)

  return (
    <div className="bg-card fixed top-0 left-0 z-50 flex h-screen w-64 flex-col justify-between border-r shadow-sm">
      <div className="flex w-full flex-col space-y-8 px-6 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full shadow-md">
            <Image src="/img/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-foreground text-lg font-black leading-tight tracking-tight">
              GENIO
            </span>
            <span className="text-primary text-xs font-bold leading-tight tracking-widest">
              SYARIAH HOTEL
            </span>
          </div>
        </div>

        <nav className="flex w-full flex-col space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex h-12 w-full items-center gap-4 rounded-full px-5 transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-md'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium',
                )}
                title={link.label}
              >
                <link.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm">{link.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="relative px-6 py-6 pb-8">
        <div className="bg-card border-muted flex w-full items-center justify-between rounded-full border p-2 shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-primary/20 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold">
              {user?.username ? (
                <Avatar className="h-full w-full bg-transparent">
                  <AvatarFallback className="text-primary bg-transparent text-sm font-bold">
                    {user.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <UserIcon size={18} />
              )}
            </div>
            <div className="flex flex-col items-start overflow-hidden">
              <span className="text-foreground truncate text-sm font-bold">
                {user?.username || 'Guest'}
              </span>
              <span className="text-muted-foreground truncate text-xs font-medium uppercase">
                {user?.role || 'Guest User'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-destructive hover:bg-destructive/10 mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors"
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
