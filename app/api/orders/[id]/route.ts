import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pool = await getDb()

    let query = `
      SELECT o.*, COALESCE(o.cashier_name, u.username) as cashier_name,
             coalesce(
               json_agg(
                 json_build_object(
                   'id', oi.product_id,
                   'name', oi.name,
                   'price', oi.price,
                   'qty', oi.qty,
                   'totalPrice', oi.total_price,
                   'selectedVariants', oi.variants::json
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'
             ) as items
      FROM orders o
      LEFT JOIN orders_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
    `
    const decodedId = decodeURIComponent(id)
    let paramId: string | number = decodedId
    let whereClause = ''

    if (decodedId.startsWith('INV')) {
      whereClause = ' WHERE o.invoice_number = $1'
      paramId = decodedId
    } else {
      const parsed = parseInt(decodedId)
      if (isNaN(parsed)) {
        return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
      }
      whereClause = ' WHERE o.id = $1'
      paramId = parsed
    }

    query += whereClause + ' GROUP BY o.id, u.username'

    const res = await pool.query(query, [paramId])

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
