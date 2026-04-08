import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitId = Number(searchParams.get('unitId'))

    if (!Number.isFinite(unitId) || unitId <= 0) {
      return NextResponse.json({ error: 'unitId is required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT *
        FROM city_ledger_accounts
        WHERE unit_id = $1
          AND deleted_at IS NULL
        ORDER BY account_name ASC
      `,
      [unitId],
    )

    return NextResponse.json(result.rows)
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
    const account_name = String(body.account_name || '').trim()
    const account_code = String(body.account_code || '').trim().toUpperCase()
    const credit_limit = Math.max(0, Math.round(Number(body.credit_limit || 0)))
    const payment_terms_days = Math.max(0, Math.round(Number(body.payment_terms_days || 30)))
    const contact_name = body.contact_name ? String(body.contact_name).trim() : null
    const contact_email = body.contact_email ? String(body.contact_email).trim() : null
    const contact_phone = body.contact_phone ? String(body.contact_phone).trim() : null

    if (!Number.isFinite(unit_id) || unit_id <= 0 || !account_name || !account_code) {
      return NextResponse.json({ error: 'unit_id, account_name, and account_code are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const result = await pool.query(
      `
        INSERT INTO city_ledger_accounts (
          unit_id,
          account_name,
          account_code,
          credit_limit,
          payment_terms_days,
          contact_name,
          contact_email,
          contact_phone,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
        RETURNING *
      `,
      [unit_id, account_name, account_code, credit_limit, payment_terms_days, contact_name, contact_email, contact_phone, auth.userId],
    )

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'AR_ACCOUNT_CREATE',
      resource: 'city_ledger_accounts',
      resourceId: result.rows[0].id,
      metadata: { unit_id, account_name, account_code, credit_limit, payment_terms_days },
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
