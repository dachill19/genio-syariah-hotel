import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { issueAuthToken, setAuthCookie } from '@/lib/auth'
import { AppRole } from '@/lib/access-control'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const username = String(body.username || '').trim()
    const password = String(body.password || '')

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 })
    }

    const pool = await getDb()

    const res = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    const user = res.rows[0]

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const token = issueAuthToken({
      id: user.id,
      username: user.username,
      role: user.role as AppRole,
      unit_id: user.unit_id ?? null,
    })

    const { password: _, ...safeUser } = user
    const response = NextResponse.json(safeUser)
    setAuthCookie(response, token)

    return response
  } catch (error: unknown) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
