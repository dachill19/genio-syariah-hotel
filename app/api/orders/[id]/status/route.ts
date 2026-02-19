import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { status } = await req.json()

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 })
    }

    const validStatuses = ['PENDING', 'PROCESSING', 'READY', 'COMPLETED', 'CANCELLED']
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const pool = await getDb()

    let query = 'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *'
    let paramId: string | number = id

    if (id.startsWith('INV-')) {
      query = 'UPDATE orders SET status = $1 WHERE invoice_number = $2 RETURNING *'
    } else {
      paramId = parseInt(id)
    }

    const res = await pool.query(query, [status, paramId])

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
