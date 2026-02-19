'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { User, Unit } from '@/types/pos'
import { useRouter } from 'next/navigation'

interface AuthContextType {
  user: User | null
  activeUnit: Unit | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [activeUnit, setActiveUnit] = useState<Unit | null>(null)
  const router = useRouter()

  useEffect(() => {
    const storedUser = localStorage.getItem('pos_user')
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Login failed')
      }

      const userData = await res.json()
      setUser(userData)
      localStorage.setItem('pos_user', JSON.stringify(userData))

      if (userData.unit_id === 1) {
        router.push('/pos/cafe')
      } else if (userData.unit_id === 2) {
        router.push('/pos/restaurant')
      } else {
        router.push('/pos/cafe')
      }
    } catch (error) {
      console.error('Login failed', error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('pos_user')
    router.push('/')
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        activeUnit,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
