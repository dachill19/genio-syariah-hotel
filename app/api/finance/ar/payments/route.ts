import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

type PaymentAllocationInput = {
  invoice_id: string
  allocated_amount: number
}

const SORT_MAP: Record<string, string> = {
  payment_date: 'p.payment_date',
  amount: 'p.amount',
  payment_method: 'p.payment_method',
  account_name: 'cla.account_name',
}

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitId = Number(searchParams.get('unitId'))
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || 20)))
    const sortBy = String(searchParams.get('sortBy') || 'payment_date')
    const sortOrder = String(searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    if (!Number.isFinite(unitId) || unitId <= 0) {
      return NextResponse.json({ error: 'unitId is required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const orderExpr = SORT_MAP[sortBy] || 'p.payment_date'

    const pool = await getDb()
    const countRes = await pool.query(
      'SELECT COUNT(*)::int AS total FROM payments p WHERE p.unit_id = $1 AND p.deleted_at IS NULL',
      [unitId],
    )
    const total = Number(countRes.rows[0]?.total || 0)

    const rowsRes = await pool.query(
      `
        SELECT
          p.*,
          cla.account_name,
          cla.account_code,
          COUNT(pa.id)::int AS allocation_count
        FROM payments p
        JOIN city_ledger_accounts cla ON cla.id = p.city_ledger_account_id
        LEFT JOIN payment_allocations pa ON pa.payment_id = p.id
        WHERE p.unit_id = $1
          AND p.deleted_at IS NULL
        GROUP BY p.id, cla.account_name, cla.account_code
        ORDER BY ${orderExpr} ${sortOrder}, p.created_at DESC
        LIMIT $2
        OFFSET $3
      `,
      [unitId, pageSize, (page - 1) * pageSize],
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

export async function POST(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const body = await req.json()
    const unit_id = Number(body.unit_id)
    const city_ledger_account_id = String(body.city_ledger_account_id || '').trim()
    const payment_date = String(body.payment_date || '').trim()
    const payment_method = String(body.payment_method || '').trim().toUpperCase()
    const amount = Math.round(Number(body.amount || 0))
    const reference_no = body.reference_no ? String(body.reference_no).trim() : null
    const notes = body.notes ? String(body.notes).trim() : null
    const allocations = Array.isArray(body.allocations) ? body.allocations : []

    if (!Number.isFinite(unit_id) || unit_id <= 0 || !city_ledger_account_id || !payment_date || !payment_method || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'unit_id, city_ledger_account_id, payment_date, payment_method, and positive amount are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const normalizedAllocations: PaymentAllocationInput[] = allocations.map((row: unknown) => {
      const item = row as Record<string, unknown>
      return {
        invoice_id: String(item.invoice_id || '').trim(),
        allocated_amount: Math.round(Number(item.allocated_amount || 0)),
      }
    }).filter((row: PaymentAllocationInput) => row.invoice_id && row.allocated_amount > 0)

    const allocatedTotal = normalizedAllocations.reduce((sum: number, row: PaymentAllocationInput) => sum + row.allocated_amount, 0)
    if (allocatedTotal > amount) {
      return NextResponse.json({ error: 'Allocated total cannot exceed payment amount' }, { status: 400 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const paymentRes = await client.query(
        `
          INSERT INTO payments (
            unit_id,
            city_ledger_account_id,
            payment_date,
            payment_method,
            amount,
            reference_no,
            notes,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $8)
          RETURNING *
        `,
        [unit_id, city_ledger_account_id, payment_date, payment_method, amount, reference_no, notes, auth.userId],
      )

      const payment = paymentRes.rows[0]

      for (const alloc of normalizedAllocations) {
        const invoiceRes = await client.query(
          `
            SELECT id, unit_id, total_amount, paid_amount, due_date
            FROM invoices
            WHERE id = $1
              AND deleted_at IS NULL
            LIMIT 1
          `,
          [alloc.invoice_id],
        )
        const invoice = invoiceRes.rows[0]

        if (!invoice || Number(invoice.unit_id) !== unit_id) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: `Invoice not found for allocation: ${alloc.invoice_id}` }, { status: 404 })
        }

        const outstanding = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0))
        const applied = Math.min(outstanding, alloc.allocated_amount)

        if (applied <= 0) {
          continue
        }

        await client.query(
          `
            INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
            VALUES ($1, $2, $3)
          `,
          [payment.id, alloc.invoice_id, applied],
        )

        await client.query(
          `
            UPDATE invoices
            SET
              paid_amount = paid_amount + $2,
              status = CASE
                WHEN (paid_amount + $2) >= total_amount THEN 'PAID'
                WHEN (paid_amount + $2) > 0 AND due_date < CURRENT_DATE THEN 'OVERDUE'
                WHEN (paid_amount + $2) > 0 THEN 'PARTIALLY_PAID'
                WHEN due_date < CURRENT_DATE THEN 'OVERDUE'
                ELSE 'ISSUED'
              END,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = $3
            WHERE id = $1
          `,
          [alloc.invoice_id, applied, auth.userId],
        )
      }

      const cashAccount = payment_method === 'CASH' ? '1001' : payment_method === 'CARD' || payment_method === 'DEBIT' ? '1003' : '1002'
      const receivableAccount = '1010'

      const journalRes = await client.query(
        `
          INSERT INTO journal_entries (
            unit_id,
            description,
            journal_type,
            posting_status,
            source_module,
            source_id,
            transaction_date,
            created_by,
            updated_by
          )
          VALUES ($1, 'AR payment receipt', 'GENERAL', 'POSTED', 'AR', $2, $3::date, $4, $4)
          RETURNING id
        `,
        [unit_id, payment.id, payment_date, auth.userId],
      )

      const journalId = journalRes.rows[0].id

      await client.query(
        `
          INSERT INTO journal_lines (journal_entry_id, account_code, debit, kredit, description, created_by, updated_by)
          VALUES
            ($1, $2, $3, 0, 'AR payment receipt', $4, $4),
            ($1, $5, 0, $3, 'AR payment receipt', $4, $4)
        `,
        [journalId, cashAccount, amount, auth.userId, receivableAccount],
      )

      await client.query(
        'UPDATE payments SET journal_entry_id = $2, updated_at = CURRENT_TIMESTAMP, updated_by = $3 WHERE id = $1',
        [payment.id, journalId, auth.userId],
      )

      await client.query('COMMIT')

      await writeAuditLog(pool, {
        userId: auth.userId,
        action: 'AR_PAYMENT_CREATE',
        resource: 'payments',
        resourceId: payment.id,
        metadata: { unit_id, city_ledger_account_id, payment_date, payment_method, amount, allocation_count: normalizedAllocations.length },
      })

      return NextResponse.json({ ...payment, journal_entry_id: journalId }, { status: 201 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
