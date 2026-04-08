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
    const cityLedgerAccountId = String(searchParams.get('cityLedgerAccountId') || '').trim()
    const asOfDate = String(searchParams.get('asOfDate') || '').trim()

    if (!Number.isFinite(unitId) || unitId <= 0 || !cityLedgerAccountId || !asOfDate) {
      return NextResponse.json({ error: 'unitId, cityLedgerAccountId, and asOfDate are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()

    const accountRes = await pool.query(
      `
        SELECT id, account_name, account_code, credit_limit, payment_terms_days
        FROM city_ledger_accounts
        WHERE id = $1
          AND unit_id = $2
          AND deleted_at IS NULL
        LIMIT 1
      `,
      [cityLedgerAccountId, unitId],
    )
    const account = accountRes.rows[0]
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const invoicesRes = await pool.query(
      `
        SELECT
          id,
          invoice_number,
          invoice_date,
          due_date,
          total_amount,
          paid_amount,
          GREATEST(total_amount - paid_amount, 0)::bigint AS outstanding_amount,
          CASE
            WHEN paid_amount >= total_amount THEN 'PAID'
            WHEN paid_amount > 0 AND due_date < $3::date THEN 'OVERDUE'
            WHEN paid_amount > 0 THEN 'PARTIALLY_PAID'
            WHEN due_date < $3::date THEN 'OVERDUE'
            ELSE 'ISSUED'
          END AS effective_status
        FROM invoices
        WHERE unit_id = $1
          AND city_ledger_account_id = $2
          AND deleted_at IS NULL
          AND invoice_date <= $3::date
        ORDER BY invoice_date ASC, invoice_number ASC
      `,
      [unitId, cityLedgerAccountId, asOfDate],
    )

    const paymentsRes = await pool.query(
      `
        SELECT
          p.id,
          p.payment_date,
          p.payment_method,
          p.amount,
          p.reference_no,
          p.notes,
          COALESCE(SUM(pa.allocated_amount), 0)::bigint AS allocated_amount
        FROM payments p
        LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
        WHERE p.unit_id = $1
          AND p.city_ledger_account_id = $2
          AND p.deleted_at IS NULL
          AND p.payment_date <= $3::date
        GROUP BY p.id
        ORDER BY p.payment_date ASC, p.created_at ASC
      `,
      [unitId, cityLedgerAccountId, asOfDate],
    )

    return NextResponse.json({
      account,
      as_of_date: asOfDate,
      invoices: invoicesRes.rows,
      payments: paymentsRes.rows,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
