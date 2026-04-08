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
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          GREATEST(i.total_amount - i.paid_amount, 0)::bigint AS outstanding_amount,
          ($2::date - i.due_date::date)::int AS days_overdue,
          cla.account_code,
          cla.account_name
        FROM invoices i
        JOIN city_ledger_accounts cla ON cla.id = i.city_ledger_account_id
        WHERE i.unit_id = $1
          AND i.deleted_at IS NULL
          AND i.due_date < $2::date
          AND (i.total_amount - i.paid_amount) > 0
        ORDER BY days_overdue DESC, i.invoice_number ASC
      `,
      [unitId, asOfDate],
    )

    const header = ['invoice_number', 'invoice_date', 'due_date', 'outstanding_amount', 'days_overdue', 'account_code', 'account_name']
    const lines = [header.join(',')]

    for (const row of rowsRes.rows) {
      lines.push([
        toCsvCell(row.invoice_number),
        toCsvCell(row.invoice_date),
        toCsvCell(row.due_date),
        toCsvCell(row.outstanding_amount),
        toCsvCell(row.days_overdue),
        toCsvCell(row.account_code),
        toCsvCell(row.account_name),
      ].join(','))
    }

    const fileName = `ar-overdue-${unitId}-${asOfDate}.csv`
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
