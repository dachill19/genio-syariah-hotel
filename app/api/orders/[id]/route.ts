import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { canAccessUnit, requireAuth } from '@/lib/auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, [
    'SUPER_ADMIN',
    'FINANCE_MANAGER',
    'AUDITOR',
    'MANAGER',
    'CASHIER',
    'DEPARTMENT_HEAD',
  ])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

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
                   'selectedVariants', oi.variants::json,
                   'note', oi.note
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'
             ) as items
      FROM orders o
      LEFT JOIN orders_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
    `
    const decodedId = decodeURIComponent(id)
    let whereClause = ''

    if (decodedId.startsWith('INV')) {
      whereClause = ' WHERE o.invoice_number = $1'
    } else {
      whereClause = ' WHERE o.id = $1'
    }

    query += whereClause + ' GROUP BY o.id, u.username'

    const res = await pool.query(query, [decodedId])

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if (!canAccessUnit(auth, Number(res.rows[0].unit_id))) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { id } = await params
    const body = await req.json()
    const { items, subtotal, tax_amount, grand_total } = body

    const orderId = id

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const orderRes = await client.query('SELECT unit_id FROM orders WHERE id = $1 LIMIT 1', [orderId])
      const order = orderRes.rows[0]
      if (!order) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      if (!canAccessUnit(auth, Number(order.unit_id))) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
      }

      await client.query('DELETE FROM orders_items WHERE order_id = $1', [orderId])

      const insertItemText = `
        INSERT INTO orders_items (order_id, product_id, name, price, qty, total_price, variants, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
          item.note || null,
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
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 400 })
  }
}
