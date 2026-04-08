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
    const toDate = String(searchParams.get('toDate') || '').trim()

    if (!Number.isFinite(unitId) || unitId <= 0 || !toDate) {
      return NextResponse.json({ error: 'unitId and toDate are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const rowsRes = await pool.query(
      `
        SELECT
          p.payment_date,
          p.id,
          p.payment_method,
          p.amount,
          p.reference_no,
          cla.account_code,
          cla.account_name,
          COUNT(pa.id)::int AS allocation_count,
          COALESCE(SUM(pa.allocated_amount), 0)::bigint AS allocated_total
        FROM payments p
        JOIN city_ledger_accounts cla ON cla.id = p.city_ledger_account_id
        LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
        WHERE p.unit_id = $1
          AND p.deleted_at IS NULL
          AND p.payment_date <= $2::date
        GROUP BY p.id, cla.account_code, cla.account_name
        ORDER BY p.payment_date DESC, p.created_at DESC
      `,
      [unitId, toDate],
    )

    const header = ['payment_date', 'payment_id', 'payment_method', 'amount', 'reference_no', 'account_code', 'account_name', 'allocation_count', 'allocated_total']
    const lines = [header.join(',')]

    for (const row of rowsRes.rows) {
      lines.push([
        toCsvCell(row.payment_date),
        toCsvCell(row.id),
        toCsvCell(row.payment_method),
        toCsvCell(row.amount),
        toCsvCell(row.reference_no),
        toCsvCell(row.account_code),
        toCsvCell(row.account_name),
        toCsvCell(row.allocation_count),
        toCsvCell(row.allocated_total),
      ].join(','))
    }

    const fileName = `ar-payments-${unitId}-${toDate}.csv`
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
