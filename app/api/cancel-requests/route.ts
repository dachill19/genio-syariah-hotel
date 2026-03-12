import { getDb } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/cancel-requests?unitId=2&status=PENDING
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')
  const status = searchParams.get('status')

  if (!unitId) return NextResponse.json({ error: 'unitId is required' }, { status: 400 })

  const db = await getDb()

  let query = `
    SELECT
      cr.id,
      cr.reason,
      cr.status,
      cr.created_at,
      cr.reviewed_at,
      o.id AS order_id,
      o.invoice_number,
      o.table_number,
      o.customer_name,
      o.grand_total,
      o.subtotal,
      o.tax_amount,
      u_req.username AS requested_by_name,
      u_rev.username AS reviewed_by_name
    FROM cancel_requests cr
    JOIN orders o ON o.id = cr.order_id
    JOIN users u_req ON u_req.id = cr.requested_by
    LEFT JOIN users u_rev ON u_rev.id = cr.reviewed_by
    WHERE cr.unit_id = $1
  `
  const params: (string | number)[] = [parseInt(unitId)]

  if (status) {
    params.push(status)
    query += ` AND cr.status = $${params.length}`
  }

  query += ' ORDER BY cr.created_at DESC'

  const result = await db.query(query, params)
  return NextResponse.json(result.rows)
}

// POST /api/cancel-requests
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { order_id, unit_id, requested_by, reason } = body

  if (!order_id || !unit_id || !requested_by) {
    return NextResponse.json({ error: 'order_id, unit_id, and requested_by are required' }, { status: 400 })
  }

  const db = await getDb()

  // Check for existing pending request for this order
  const existing = await db.query(
    `SELECT id FROM cancel_requests WHERE order_id = $1 AND status = 'PENDING'`,
    [order_id],
  )
  if (existing.rows.length > 0) {
    return NextResponse.json({ error: 'Cancel request already pending for this order' }, { status: 409 })
  }

  const result = await db.query(
    `INSERT INTO cancel_requests (unit_id, order_id, requested_by, reason) VALUES ($1, $2, $3, $4) RETURNING id`,
    [unit_id, order_id, requested_by, reason || null],
  )

  return NextResponse.json({ id: result.rows[0].id }, { status: 201 })
}
