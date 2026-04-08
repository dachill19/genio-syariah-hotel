import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit-log'

function getIpAddress(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for')
  if (!forwarded) return null
  return forwarded.split(',')[0]?.trim() || null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth
  const { id } = await params
  const periodId = Number(id)

  if (!Number.isFinite(periodId) || periodId <= 0) {
    return NextResponse.json({ error: 'Invalid period id' }, { status: 400 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const reason = String(body.reason || '').trim()

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const pool = await getDb()
    const periodRes = await pool.query(
      `
        SELECT id, status, closed_at
        FROM accounting_periods
        WHERE id = $1
        LIMIT 1
      `,
      [periodId],
    )

    const period = periodRes.rows[0]
    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 })
    }
    if (period.status === 'CLOSED') {
      return NextResponse.json({ error: 'Period already closed' }, { status: 409 })
    }

    const updatedRes = await pool.query(
      `
        UPDATE accounting_periods
        SET status = 'CLOSED',
            closed_at = CURRENT_TIMESTAMP,
            closed_by = $2,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $2
        WHERE id = $1
        RETURNING id, status, closed_at
      `,
      [periodId, auth.userId],
    )

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'ACCOUNTING_PERIOD_CLOSE',
      tableName: 'accounting_periods',
      recordId: String(periodId),
      oldValue: {
        status: period.status,
        closed_at: period.closed_at,
      },
      newValue: updatedRes.rows[0],
      ipAddress: getIpAddress(req),
      metadata: { reason },
    })

    return NextResponse.json(updatedRes.rows[0])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}