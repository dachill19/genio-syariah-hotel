'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Coffee,
  ShoppingCart,
  FileText,
  Settings,
  User as UserIcon,
  LogOut,
  Utensils,
  ClipboardList,
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

  const isResto = user?.unit_id === 2
  const isCafe = user?.unit_id === 1
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'

  const links = [
    // CAFE
    {
      href: '/pos/cafe',
      icon: Coffee,
      label: 'Cafe POS',
      hidden: isResto && !isAdminOrManager,
    },
    {
      href: '/pos/cafe/orders',
      icon: ClipboardList,
      label: 'Cafe Orders',
      hidden: isResto && !isAdminOrManager,
    },
    {
      href: '/pos/cafe/report',
      icon: FileText,
      label: 'Cafe Report',
      hidden: isResto && !isAdminOrManager,
    },

    // RESTO
    {
      href: '/pos/restaurant',
      icon: Utensils,
      label: 'Resto POS',
      hidden: isCafe && !isAdminOrManager,
    },
    {
      href: '/pos/restaurant/orders',
      icon: ClipboardList,
      label: 'Resto Orders',
      hidden: isCafe && !isAdminOrManager,
    },
    {
      href: '/pos/restaurant/report',
      icon: FileText,
      label: 'Resto Report',
      hidden: isCafe && !isAdminOrManager,
    },
  ].filter((link) => !link.hidden)

  return (
    <div className="bg-card fixed top-0 left-0 z-50 flex h-screen w-64 flex-col justify-between border-r shadow-sm">
      <div className="flex w-full flex-col space-y-8 px-6 py-6">
        <div className="flex items-center gap-3 px-2">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full shadow-md">
            <Image src="/img/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <span className="text-foreground text-xl font-black tracking-tight">
            GENIO <span className="text-primary">POS</span>
          </span>
        </div>

        <nav className="flex w-full flex-col space-y-2">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex h-14 w-full items-center gap-4 rounded-full px-5 transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-md'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground font-medium',
                )}
                title={link.label}
              >
                <link.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
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
