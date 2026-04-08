import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

const SORT_MAP: Record<string, string> = {
  invoice_number: 'i.invoice_number',
  invoice_date: 'i.invoice_date',
  due_date: 'i.due_date',
  total_amount: 'i.total_amount',
  paid_amount: 'i.paid_amount',
  status: 'i.status',
  account_name: 'cla.account_name',
}

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitId = Number(searchParams.get('unitId'))
    const status = searchParams.get('status')
    const page = Math.max(1, Number(searchParams.get('page') || 1))
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || 20)))
    const sortBy = String(searchParams.get('sortBy') || 'invoice_date')
    const sortOrder = String(searchParams.get('sortOrder') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'

    if (!Number.isFinite(unitId) || unitId <= 0) {
      return NextResponse.json({ error: 'unitId is required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const orderExpr = SORT_MAP[sortBy] || 'i.invoice_date'

    const pool = await getDb()
    const filters: string[] = ['i.unit_id = $1', 'i.deleted_at IS NULL']
    const params: unknown[] = [unitId]

    if (status) {
      params.push(status)
      filters.push(`i.status = $${params.length}`)
    }

    const whereSql = filters.join(' AND ')

    const countRes = await pool.query(`SELECT COUNT(*)::int AS total FROM invoices i WHERE ${whereSql}`, params)
    const total = Number(countRes.rows[0]?.total || 0)

    params.push(pageSize)
    params.push((page - 1) * pageSize)

    const rowsRes = await pool.query(
      `
        SELECT
          i.*,
          cla.account_name,
          cla.account_code,
          GREATEST(i.total_amount - i.paid_amount, 0)::bigint AS outstanding_amount,
          CASE
            WHEN i.paid_amount >= i.total_amount THEN 'PAID'
            WHEN i.paid_amount > 0 AND i.due_date < CURRENT_DATE THEN 'OVERDUE'
            WHEN i.paid_amount > 0 THEN 'PARTIALLY_PAID'
            WHEN i.due_date < CURRENT_DATE THEN 'OVERDUE'
            ELSE 'ISSUED'
          END AS effective_status
        FROM invoices i
        JOIN city_ledger_accounts cla ON cla.id = i.city_ledger_account_id
        WHERE ${whereSql}
        ORDER BY ${orderExpr} ${sortOrder}, i.created_at DESC
        LIMIT $${params.length - 1}
        OFFSET $${params.length}
      `,
      params,
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
    const invoice_number = String(body.invoice_number || '').trim().toUpperCase()
    const invoice_date = String(body.invoice_date || '').trim()
    const due_date = String(body.due_date || '').trim()
    const subtotal_amount = Math.max(0, Math.round(Number(body.subtotal_amount || 0)))
    const tax_amount = Math.max(0, Math.round(Number(body.tax_amount || 0)))
    const source_module = body.source_module ? String(body.source_module).trim() : null
    const source_id = body.source_id ? String(body.source_id).trim() : null

    if (!Number.isFinite(unit_id) || unit_id <= 0 || !city_ledger_account_id || !invoice_number || !invoice_date || !due_date) {
      return NextResponse.json({ error: 'unit_id, city_ledger_account_id, invoice_number, invoice_date, and due_date are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const total_amount = subtotal_amount + tax_amount

    const pool = await getDb()
    const result = await pool.query(
      `
        INSERT INTO invoices (
          unit_id,
          city_ledger_account_id,
          invoice_number,
          invoice_date,
          due_date,
          subtotal_amount,
          tax_amount,
          total_amount,
          paid_amount,
          status,
          source_module,
          source_id,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, 0, 'ISSUED', $9, $10, $11, $11)
        RETURNING *
      `,
      [unit_id, city_ledger_account_id, invoice_number, invoice_date, due_date, subtotal_amount, tax_amount, total_amount, source_module, source_id, auth.userId],
    )

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'AR_INVOICE_CREATE',
      resource: 'invoices',
      resourceId: result.rows[0].id,
      metadata: { unit_id, city_ledger_account_id, invoice_number, invoice_date, due_date, subtotal_amount, tax_amount, total_amount },
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
