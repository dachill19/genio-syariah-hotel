'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User, Unit } from '@/types/pos'

interface AuthState {
  user: User | null
  activeUnit: Unit | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      activeUnit: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
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
        set({ user: userData, isAuthenticated: true })
      },

      logout: () => {
        set({ user: null, activeUnit: null, isAuthenticated: false })
      },
    }),
    {
      name: 'pos-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        user: state.user,
        activeUnit: state.activeUnit,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
