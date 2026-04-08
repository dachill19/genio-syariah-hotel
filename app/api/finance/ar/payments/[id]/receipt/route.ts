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
          p.id,
          p.unit_id,
          p.payment_date,
          p.payment_method,
          p.amount,
          p.reference_no,
          p.notes,
          p.created_at,
          p.city_ledger_account_id,
          cla.account_name,
          cla.account_code,
          u.name AS unit_name,
          u.type AS unit_type
        FROM payments p
        JOIN city_ledger_accounts cla ON cla.id = p.city_ledger_account_id
        LEFT JOIN units u ON u.id = p.unit_id
        WHERE p.id = $1
          AND p.deleted_at IS NULL
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
          pa.invoice_id,
          pa.allocated_amount,
          i.invoice_number,
          i.invoice_date,
          i.due_date
        FROM payment_allocations pa
        JOIN invoices i ON i.id = pa.invoice_id
        WHERE pa.payment_id = $1
        ORDER BY i.invoice_date ASC, i.invoice_number ASC
      `,
      [id],
    )

    const receiptNumber = `AR-RCPT-${String(payment.payment_date).slice(0, 10).replace(/-/g, '')}-${String(payment.id).slice(0, 8).toUpperCase()}`

    return NextResponse.json({
      receipt_number: receiptNumber,
      payment: {
        id: payment.id,
        payment_date: payment.payment_date,
        payment_method: payment.payment_method,
        amount: payment.amount,
        reference_no: payment.reference_no,
        notes: payment.notes,
        created_at: payment.created_at,
      },
      account: {
        id: payment.city_ledger_account_id,
        account_name: payment.account_name,
        account_code: payment.account_code,
      },
      unit: {
        id: payment.unit_id,
        name: payment.unit_name,
        type: payment.unit_type,
      },
      allocations: allocationsRes.rows,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
