import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, [
    'SUPER_ADMIN',
    'FINANCE_MANAGER',
    'AUDITOR',
    'MANAGER',
    'CASHIER',
    'DEPARTMENT_HEAD',
  ])
  if (!authCheck.ok) return authCheck.response

  try {
    const { id } = await params
    const pool = await getDb()

    const res = await pool.query('SELECT * FROM units WHERE id = $1', [id])

    if (res.rows.length === 0) {
      return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
