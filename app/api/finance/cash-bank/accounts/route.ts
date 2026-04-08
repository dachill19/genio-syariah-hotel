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
        FROM bank_accounts
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
    const account_number = String(body.account_number || '').trim()
    const bank_name = body.bank_name ? String(body.bank_name).trim() : null
    const currency_code = String(body.currency_code || 'IDR').trim().toUpperCase()
    const account_type = String(body.account_type || 'BANK').trim().toUpperCase()

    if (!Number.isFinite(unit_id) || unit_id <= 0 || !account_name || !account_number) {
      return NextResponse.json({ error: 'unit_id, account_name, and account_number are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const result = await pool.query(
      `
        INSERT INTO bank_accounts (
          unit_id,
          account_name,
          account_number,
          bank_name,
          currency_code,
          account_type,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
        RETURNING *
      `,
      [unit_id, account_name, account_number, bank_name, currency_code, account_type, auth.userId],
    )

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'BANK_ACCOUNT_CREATE',
      resource: 'bank_accounts',
      resourceId: String(result.rows[0].id),
      metadata: { unit_id, account_name, account_number, bank_name, currency_code, account_type },
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
