import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json()
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

    const { password: _, ...safeUser } = user
    return NextResponse.json(safeUser)
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
