'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Lock, User as UserIcon } from 'lucide-react'
import Image from 'next/image'

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user) {
      const isManager = user.role === 'MANAGER'

      if (user.unit_id === 1) {
        router.push(isManager ? '/pos/cafe/manager' : '/pos/cafe')
      } else if (user.unit_id === 2) {
        router.push(isManager ? '/pos/restaurant/manager' : '/pos/restaurant')
      } else {
        router.push('/pos/cafe')
      }
    }
  }, [isAuthenticated, user, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(username, password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-muted flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 text-center">
          <div className="relative mx-auto mb-4 h-24 w-24 overflow-hidden rounded-full shadow-lg">
            <Image src="/img/logo.png" alt="Logo" fill className="object-cover" priority />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Genio Syariah Hotel</CardTitle>
          <CardDescription>Hotel Management System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Username</label>
              <div className="relative">
                <UserIcon className="text-muted-foreground absolute top-2.5 left-3 h-5 w-5" />
                <Input
                  className="h-10 pl-10"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <div className="relative">
                <Lock className="text-muted-foreground absolute top-2.5 left-3 h-5 w-5" />
                <Input
                  className="h-10 pl-10"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            {error && <p className="text-center text-sm font-medium text-red-500">{error}</p>}

            <Button
              type="submit"
              className="mt-2 h-12 w-full text-lg"
              disabled={loading || !username || !password}
            >
              {loading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
