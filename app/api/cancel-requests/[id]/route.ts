import { getDb } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// PATCH /api/cancel-requests/[id]
// Body: { action: 'APPROVE' | 'REJECT', reviewed_by: string }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { action, reviewed_by } = body

  if (!action || !reviewed_by) {
    return NextResponse.json({ error: 'action and reviewed_by are required' }, { status: 400 })
  }
  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json({ error: 'action must be APPROVE or REJECT' }, { status: 400 })
  }

  const db = await getDb()

  const requestRes = await db.query(
    `SELECT * FROM cancel_requests WHERE id = $1`,
    [id],
  )
  if (requestRes.rows.length === 0) {
    return NextResponse.json({ error: 'Cancel request not found' }, { status: 404 })
  }
  const cancelRequest = requestRes.rows[0]
  if (cancelRequest.status !== 'PENDING') {
    return NextResponse.json({ error: 'Cancel request is no longer pending' }, { status: 409 })
  }

  const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED'

  await db.query(
    `UPDATE cancel_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`,
    [newStatus, reviewed_by, id],
  )

  // If approved, cancel the order
  if (action === 'APPROVE') {
    await db.query(
      `UPDATE orders SET payment_status = 'CANCELLED' WHERE id = $1`,
      [cancelRequest.order_id],
    )
  }

  return NextResponse.json({ success: true, status: newStatus })
}
