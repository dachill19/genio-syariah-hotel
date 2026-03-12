import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const pool = await getDb()

    let paramId: string | number = id
    const isInvoice = id.startsWith('INV-')
    if (!isInvoice) {
      paramId = parseInt(id)
    }
    const idColumn = isInvoice ? 'invoice_number' : 'id'

    const updates: string[] = []
    const values: any[] = []

    if (body.payment_status) {
      const validPayment = ['UNPAID', 'PAID', 'REFUNDED', 'VOID']
      if (!validPayment.includes(body.payment_status)) {
        return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
      }
      values.push(body.payment_status)
      updates.push(`payment_status = $${values.length}`)
    }

    if (body.kitchen_status) {
      const validKitchen = ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']
      if (!validKitchen.includes(body.kitchen_status)) {
        return NextResponse.json({ error: 'Invalid kitchen_status' }, { status: 400 })
      }
      values.push(body.kitchen_status)
      updates.push(`kitchen_status = $${values.length}`)
    }

    if (body.payment_method) {
      values.push(body.payment_method)
      updates.push(`payment_method = $${values.length}`)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid status fields provided' }, { status: 400 })
    }

    values.push(paramId)
    const query = `UPDATE orders SET ${updates.join(', ')} WHERE ${idColumn} = $${values.length} RETURNING *`

    const res = await pool.query(query, values)

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
