'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import {
  Coffee,
  ShoppingCart,
  FileText,
  Settings,
  User as UserIcon,
  LogOut,
  Utensils,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/auth-context'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import Image from 'next/image'

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const profileRef = useRef<HTMLDivElement>(null)

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
      href: '/pos/cafe/report',
      icon: FileText,
      label: 'Cafe Report',
      hidden: isResto && !isAdminOrManager,
    },

    // RESTO
    {
      href: '/pos/restaurant',
      icon: Utensils,
      label: 'Restaurant POS',
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
    <div className="bg-card fixed top-0 left-0 z-50 flex h-screen w-20 flex-col items-center justify-between border-r py-6 shadow-sm">
      <div className="flex w-full flex-col items-center space-y-6">
        <div className="relative h-12 w-12 overflow-hidden rounded-full shadow-lg">
          <Image src="/img/logo.png" alt="Logo" fill className="object-cover" />
        </div>

        <nav className="flex w-full flex-col items-center space-y-4">
          {links.map((link) => {
            const isActive = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                title={link.label}
              >
                <link.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="relative" ref={profileRef}>
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="bg-primary/10 text-primary hover:bg-primary/20 flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-sm transition-colors"
          title="User Profile"
        >
          {user?.username ? (
            <Avatar className="h-full w-full bg-transparent">
              <AvatarFallback className="text-primary bg-transparent text-lg font-bold">
                {user.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <UserIcon size={20} />
          )}
        </button>

        {isProfileOpen && (
          <div className="bg-card text-card-foreground animate-in fade-in slide-in-from-left-5 absolute bottom-0 left-14 z-50 mb-2 w-48 rounded-xl border p-4 shadow-xl duration-200">
            <div className="flex flex-col gap-3">
              <div className="space-y-1">
                <h4 className="text-sm leading-none font-semibold">{user?.username || 'Guest'}</h4>
                <p className="text-muted-foreground text-xs">{user?.role || 'Guest User'}</p>
              </div>
              <div className="bg-border h-px" />
              <button
                onClick={logout}
                className="hover:bg-destructive/10 text-destructive flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
