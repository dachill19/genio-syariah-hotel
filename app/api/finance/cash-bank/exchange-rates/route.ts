import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  try {
    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT *
        FROM exchange_rates
        WHERE deleted_at IS NULL
        ORDER BY rate_date DESC, from_currency ASC, to_currency ASC
        LIMIT 200
      `,
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
    const rate_date = String(body.rate_date || '').trim()
    const from_currency = String(body.from_currency || '').trim().toUpperCase()
    const to_currency = String(body.to_currency || 'IDR').trim().toUpperCase()
    const rate = Math.round(Number(body.rate))

    if (!rate_date || !from_currency || !to_currency || !Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json({ error: 'rate_date, from_currency, to_currency, and positive rate are required' }, { status: 400 })
    }

    const pool = await getDb()
    const result = await pool.query(
      `
        INSERT INTO exchange_rates (
          rate_date,
          from_currency,
          to_currency,
          rate,
          created_by,
          updated_by
        )
        VALUES ($1::date, $2, $3, $4, $5, $5)
        ON CONFLICT (rate_date, from_currency, to_currency)
        DO UPDATE SET
          rate = EXCLUDED.rate,
          updated_at = CURRENT_TIMESTAMP,
          updated_by = EXCLUDED.updated_by,
          deleted_at = NULL
        RETURNING *
      `,
      [rate_date, from_currency, to_currency, rate, auth.userId],
    )

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'EXCHANGE_RATE_UPSERT',
      resource: 'exchange_rates',
      resourceId: String(result.rows[0].id),
      metadata: { rate_date, from_currency, to_currency, rate },
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
