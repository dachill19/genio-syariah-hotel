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

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { items, subtotal, tax_amount, grand_total } = body

    const orderId = parseInt(id)
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      await client.query('DELETE FROM orders_items WHERE order_id = $1', [orderId])

      const insertItemText = `
        INSERT INTO orders_items (order_id, product_id, name, price, qty, total_price, variants)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `

      for (const item of items) {
        await client.query(insertItemText, [
          orderId,
          item.id,
          item.name,
          item.price,
          item.qty,
          item.totalPrice,
          JSON.stringify(item.selectedVariants || {}),
        ])
      }

      await client.query(
        'UPDATE orders SET subtotal = $1, tax_amount = $2, grand_total = $3 WHERE id = $4',
        [subtotal, tax_amount, grand_total, orderId],
      )

      await client.query('COMMIT')

      return NextResponse.json({ success: true, id: orderId })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
