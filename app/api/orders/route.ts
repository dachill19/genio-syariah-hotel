import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  try {
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
    let params: any[] = []

    if (status === 'active') {
      query += " WHERE o.status IN ('PENDING', 'PROCESSING', 'READY')"
    } else if (status) {
      query += ' WHERE o.status = $1'
      params = [status]
    }

    query += ' GROUP BY o.id, u.username ORDER BY o.created_at DESC'

    const res = await pool.query(query, params)

    return NextResponse.json(res.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      items,
      subtotal,
      grand_total,
      tax_amount,
      payment_method,
      table_number,
      customer_name,
      order_type,
      unit_id,
      user_id,
    } = body

    const pool = await getDb()

    let cashier_name = 'System'
    if (user_id) {
      const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [user_id])
      if (userRes.rows.length > 0) {
        cashier_name = userRes.rows[0].username
      }
    }

    const unitRes = await pool.query('SELECT type FROM units WHERE id = $1', [unit_id || 1])
    const unitType = unitRes.rows[0]?.type || 'POS'

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomStr = Math.floor(1000 + Math.random() * 9000)
    const invoice_number = `INV-${unitType}-${dateStr}-${randomStr}`

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const insertOrderText = `
            INSERT INTO orders (
              invoice_number, subtotal, tax_amount, grand_total, payment_method, 
              status, table_number, customer_name, order_type, unit_id, user_id, cashier_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `

      const res = await client.query(insertOrderText, [
        invoice_number,
        subtotal,
        tax_amount || 0,
        grand_total,
        payment_method,
        'PENDING',
        table_number || '',
        customer_name || '',
        order_type || 'Dine in',
        unit_id || 1,
        user_id || null,
        cashier_name,
      ])

      const orderId = res.rows[0].id

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

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        id: orderId,
        invoice_number,
        cashier_name,
        created_at: new Date(),
      })
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
