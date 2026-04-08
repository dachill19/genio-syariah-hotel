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
    const asOfDate = String(searchParams.get('asOfDate') || '').trim()

    if (!Number.isFinite(unitId) || unitId <= 0 || !asOfDate) {
      return NextResponse.json({ error: 'unitId and asOfDate are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT
          i.city_ledger_account_id,
          cla.account_name,
          cla.account_code,
          SUM(CASE WHEN ($2::date - i.due_date::date) <= 0 THEN GREATEST(i.total_amount - i.paid_amount, 0) ELSE 0 END)::bigint AS current,
          SUM(CASE WHEN ($2::date - i.due_date::date) BETWEEN 1 AND 30 THEN GREATEST(i.total_amount - i.paid_amount, 0) ELSE 0 END)::bigint AS d1_30,
          SUM(CASE WHEN ($2::date - i.due_date::date) BETWEEN 31 AND 60 THEN GREATEST(i.total_amount - i.paid_amount, 0) ELSE 0 END)::bigint AS d31_60,
          SUM(CASE WHEN ($2::date - i.due_date::date) BETWEEN 61 AND 90 THEN GREATEST(i.total_amount - i.paid_amount, 0) ELSE 0 END)::bigint AS d61_90,
          SUM(CASE WHEN ($2::date - i.due_date::date) > 90 THEN GREATEST(i.total_amount - i.paid_amount, 0) ELSE 0 END)::bigint AS d90_plus,
          SUM(GREATEST(i.total_amount - i.paid_amount, 0))::bigint AS total_outstanding
        FROM invoices i
        JOIN city_ledger_accounts cla ON cla.id = i.city_ledger_account_id
        WHERE i.unit_id = $1
          AND i.deleted_at IS NULL
          AND i.invoice_date <= $2::date
          AND (i.total_amount - i.paid_amount) > 0
        GROUP BY i.city_ledger_account_id, cla.account_name, cla.account_code
        ORDER BY cla.account_name ASC
      `,
      [unitId, asOfDate],
    )

    return NextResponse.json({ rows: result.rows })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
