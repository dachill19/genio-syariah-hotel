import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const unitId = searchParams.get('unitId')
  const paymentMethod = searchParams.get('paymentMethod')
  const orderType = searchParams.get('orderType')
  const cashierName = searchParams.get('cashierName')

  if (!startDate || !endDate || !unitId) {
    return NextResponse.json({ error: 'startDate, endDate, and unitId are required' }, { status: 400 })
  }

  try {
    const pool = await getDb()

    let query = `
      SELECT o.*, 
             COALESCE(json_agg(
               json_build_object(
                 'id', oi.id,
                 'product_id', oi.product_id,
                 'name', oi.name,
                 'price', oi.price,
                 'qty', oi.qty,
                 'total_price', oi.total_price,
                 'note', oi.note
               )
             ) FILTER (WHERE oi.id IS NOT NULL), '[]') as items
      FROM orders o
      LEFT JOIN orders_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1 AND $2
        AND o.unit_id = $3
        AND o.payment_status != 'VOID'
    `
    const params: any[] = [startDate, endDate, unitId]
    let paramIndex = 4

    if (paymentMethod && paymentMethod !== 'ALL') {
      const methods = paymentMethod.split(',')
      query += ` AND o.payment_method = ANY($${paramIndex})`
      params.push(methods)
      paramIndex++
    }

    if (orderType && orderType !== 'ALL') {
      const types = orderType.split(',')
      query += ` AND o.order_type = ANY($${paramIndex})`
      params.push(types)
      paramIndex++
    }

    if (cashierName && cashierName.trim() !== '') {
      query += ` AND o.cashier_name ILIKE $${paramIndex}`
      params.push(`%${cashierName.trim()}%`)
      paramIndex++
    }

    query += ` GROUP BY o.id ORDER BY o.created_at DESC`

    const { rows } = await pool.query(query, params)

    return NextResponse.json(rows)
  } catch (error: any) {
    console.error('History API error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
