import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth
  const { id } = await params

  try {
    const pool = await getDb()

    const paymentRes = await pool.query(
      `
        SELECT
          p.*,
          cla.account_name,
          cla.account_code,
          COALESCE(SUM(pa.allocated_amount), 0)::bigint AS allocated_amount,
          COUNT(pa.id)::int AS allocation_count
        FROM payments p
        JOIN city_ledger_accounts cla ON cla.id = p.city_ledger_account_id
        LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
        WHERE p.id = $1
          AND p.deleted_at IS NULL
        GROUP BY p.id, cla.account_name, cla.account_code
        LIMIT 1
      `,
      [id],
    )

    const payment = paymentRes.rows[0]
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }
    if (!canAccessUnit(auth, Number(payment.unit_id))) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const allocationsRes = await pool.query(
      `
        SELECT
          pa.id,
          pa.invoice_id,
          pa.allocated_amount,
          pa.created_at,
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          i.total_amount,
          i.paid_amount,
          GREATEST(i.total_amount - i.paid_amount, 0)::bigint AS outstanding_amount,
          CASE
            WHEN i.paid_amount >= i.total_amount THEN 'PAID'
            WHEN i.paid_amount > 0 AND i.due_date < CURRENT_DATE THEN 'OVERDUE'
            WHEN i.paid_amount > 0 THEN 'PARTIALLY_PAID'
            WHEN i.due_date < CURRENT_DATE THEN 'OVERDUE'
            ELSE 'ISSUED'
          END AS effective_status
        FROM payment_allocations pa
        JOIN invoices i ON i.id = pa.invoice_id
        WHERE pa.payment_id = $1
        ORDER BY i.invoice_date ASC, i.invoice_number ASC
      `,
      [id],
    )

    return NextResponse.json({
      payment,
      allocations: allocationsRes.rows,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
