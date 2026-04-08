import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

function toCsvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

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
    const rowsRes = await pool.query(
      `
        SELECT
          cla.account_code,
          cla.account_name,
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
        GROUP BY cla.account_code, cla.account_name
        ORDER BY cla.account_name ASC
      `,
      [unitId, asOfDate],
    )

    const header = ['account_code', 'account_name', 'current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus', 'total_outstanding']
    const lines = [header.join(',')]

    for (const row of rowsRes.rows) {
      lines.push([
        toCsvCell(row.account_code),
        toCsvCell(row.account_name),
        toCsvCell(row.current),
        toCsvCell(row.d1_30),
        toCsvCell(row.d31_60),
        toCsvCell(row.d61_90),
        toCsvCell(row.d90_plus),
        toCsvCell(row.total_outstanding),
      ].join(','))
    }

    const fileName = `ar-aging-${unitId}-${asOfDate}.csv`
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
