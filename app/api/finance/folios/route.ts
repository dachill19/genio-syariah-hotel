import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_HEAD'])
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
        SELECT
          f.id,
          f.reservation_no,
          f.room_number,
          g.guest_name,
          f.check_in_date,
          f.check_out_date,
          f.room_rate,
          f.status,
          COALESCE(SUM(CASE WHEN fc.status IN ('ACTIVE', 'VOID_REVERSAL') THEN fc.amount_base ELSE 0 END), 0)::bigint AS total_charges
        FROM folios f
        LEFT JOIN guests g ON g.id = f.guest_id
        LEFT JOIN folio_charges fc ON fc.folio_id = f.id AND fc.deleted_at IS NULL
        WHERE f.unit_id = $1
          AND f.deleted_at IS NULL
        GROUP BY f.id, g.guest_name
        ORDER BY f.created_at DESC
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
    const guest_name = String(body.guest_name || '').trim()
    const reservation_no = body.reservation_no ? String(body.reservation_no).trim() : null
    const room_number = String(body.room_number || '').trim()
    const check_in_date = String(body.check_in_date || '').trim()
    const check_out_date = String(body.check_out_date || '').trim()
    const room_rate = Math.round(Number(body.room_rate))

    if (!Number.isFinite(unit_id) || unit_id <= 0 || !guest_name || !room_number || !check_in_date || !check_out_date || !Number.isFinite(room_rate) || room_rate <= 0) {
      return NextResponse.json({ error: 'unit_id, guest_name, room_number, check_in_date, check_out_date, and positive room_rate are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const guestRes = await client.query(
        `
          INSERT INTO guests (unit_id, guest_name, created_by, updated_by)
          VALUES ($1, $2, $3, $3)
          RETURNING id
        `,
        [unit_id, guest_name, auth.userId],
      )

      const guestId = guestRes.rows[0].id

      const folioRes = await client.query(
        `
          INSERT INTO folios (
            unit_id,
            guest_id,
            reservation_no,
            room_number,
            check_in_date,
            check_out_date,
            room_rate,
            status,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, 'OPEN', $8, $8)
          RETURNING *
        `,
        [unit_id, guestId, reservation_no, room_number, check_in_date, check_out_date, room_rate, auth.userId],
      )

      await client.query('COMMIT')

      await writeAuditLog(pool, {
        userId: auth.userId,
        action: 'FOLIO_CREATE',
        resource: 'folios',
        resourceId: folioRes.rows[0].id,
        metadata: { unit_id, guest_name, reservation_no, room_number, check_in_date, check_out_date, room_rate },
      })

      return NextResponse.json(folioRes.rows[0], { status: 201 })
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
