import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR', 'DEPARTMENT_HEAD'])
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
    const rowsRes = await pool.query(
      `
        SELECT
          c.code,
          c.account_name,
          COALESCE(SUM(jl.debit), 0)::bigint AS total_debit,
          COALESCE(SUM(jl.kredit), 0)::bigint AS total_credit,
          (COALESCE(SUM(jl.debit), 0) - COALESCE(SUM(jl.kredit), 0))::bigint AS balance
        FROM coa c
        LEFT JOIN journal_lines jl ON jl.account_code = c.code
        LEFT JOIN journal_entries je ON je.id = jl.journal_entry_id
          AND je.unit_id = $1
          AND je.transaction_date <= $2::date
          AND je.deleted_at IS NULL
        WHERE c.deleted_at IS NULL
        GROUP BY c.code, c.account_name
        HAVING COALESCE(SUM(jl.debit), 0) <> 0 OR COALESCE(SUM(jl.kredit), 0) <> 0
        ORDER BY c.code ASC
      `,
      [unitId, asOfDate],
    )

    const totals = rowsRes.rows.reduce(
      (acc, row) => {
        acc.total_debit += Number(row.total_debit || 0)
        acc.total_credit += Number(row.total_credit || 0)
        return acc
      },
      { total_debit: 0, total_credit: 0 },
    )

    return NextResponse.json({
      rows: rowsRes.rows,
      totals: {
        ...totals,
        is_balanced: totals.total_debit === totals.total_credit,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
