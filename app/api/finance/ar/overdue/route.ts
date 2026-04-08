import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

const SORT_MAP: Record<string, string> = {
  due_date: 'i.due_date',
  outstanding_amount: 'outstanding_amount',
  days_overdue: 'days_overdue',
  account_name: 'cla.account_name',
}

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitId = Number(searchParams.get('unitId'))
    const asOfDate = String(searchParams.get('asOfDate') || '').trim()
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || 20)))
    const sortBy = String(searchParams.get('sortBy') || 'days_overdue')
    const sortOrder = String(searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    if (!Number.isFinite(unitId) || unitId <= 0 || !asOfDate) {
      return NextResponse.json({ error: 'unitId and asOfDate are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const orderExpr = SORT_MAP[sortBy] || 'days_overdue'

    const pool = await getDb()

    const countRes = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM invoices i
        WHERE i.unit_id = $1
          AND i.deleted_at IS NULL
          AND i.due_date < $2::date
          AND (i.total_amount - i.paid_amount) > 0
      `,
      [unitId, asOfDate],
    )
    const total = Number(countRes.rows[0]?.total || 0)

    const rowsRes = await pool.query(
      `
        SELECT
          i.id,
          i.invoice_number,
          i.due_date,
          GREATEST(i.total_amount - i.paid_amount, 0)::bigint AS outstanding_amount,
          ($2::date - i.due_date::date)::int AS days_overdue,
          cla.account_name,
          cla.account_code
        FROM invoices i
        JOIN city_ledger_accounts cla ON cla.id = i.city_ledger_account_id
        WHERE i.unit_id = $1
          AND i.deleted_at IS NULL
          AND i.due_date < $2::date
          AND (i.total_amount - i.paid_amount) > 0
        ORDER BY ${orderExpr} ${sortOrder}, i.invoice_number ASC
        LIMIT $3
        OFFSET $4
      `,
      [unitId, asOfDate, pageSize, (page - 1) * pageSize],
    )

    return NextResponse.json({
      rows: rowsRes.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      sort: {
        sortBy,
        sortOrder: sortOrder.toLowerCase(),
      },
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
