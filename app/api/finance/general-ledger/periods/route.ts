import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  try {
    const { searchParams } = new URL(req.url)
    const yearParam = Number(searchParams.get('year'))
    const year = Number.isFinite(yearParam) && yearParam > 0 ? yearParam : new Date().getFullYear()

    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT
          ap.*,
          fy.year
        FROM accounting_periods ap
        JOIN fiscal_years fy ON fy.id = ap.fiscal_year_id
        WHERE fy.year = $1
          AND ap.deleted_at IS NULL
        ORDER BY ap.period_number ASC
      `,
      [year],
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
