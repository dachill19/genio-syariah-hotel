import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitId = Number(searchParams.get('unitId'))
    const threshold = Number(searchParams.get('threshold') || 75)

    if (!Number.isFinite(unitId) || unitId <= 0) {
      return NextResponse.json({ error: 'unitId is required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT
          cla.id,
          cla.account_name,
          cla.account_code,
          cla.credit_limit,
          COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)::bigint AS outstanding_amount,
          CASE
            WHEN cla.credit_limit <= 0 THEN 0
            ELSE ROUND((COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)::numeric / cla.credit_limit::numeric) * 100, 2)
          END AS utilization_percent
        FROM city_ledger_accounts cla
        LEFT JOIN invoices i ON i.city_ledger_account_id = cla.id AND i.deleted_at IS NULL
        WHERE cla.unit_id = $1
          AND cla.deleted_at IS NULL
        GROUP BY cla.id
        HAVING (
          CASE
            WHEN cla.credit_limit <= 0 THEN 0
            ELSE ROUND((COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)::numeric / cla.credit_limit::numeric) * 100, 2)
          END
        ) >= $2
        ORDER BY utilization_percent DESC, cla.account_name ASC
      `,
      [unitId, threshold],
    )

    return NextResponse.json({ rows: result.rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
