import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const unitId = searchParams.get('unitId')

  if (!date) {
    return NextResponse.json({ error: 'Date is required' }, { status: 400 })
  }

  try {
    const pool = await getDb()

    let whereClause = "WHERE DATE(orders.created_at) = $1 AND orders.status != 'CANCELLED'"
    const params = [date]

    if (unitId) {
      whereClause += ` AND orders.unit_id = $${params.length + 1}`
      params.push(unitId)
    }

    const transactionsQuery = `
      SELECT orders.*,
             COALESCE(
               json_agg(
                 json_build_object(
                   'name', oi.name,
                   'qty', oi.qty,
                   'price', oi.price,
                   'selectedVariants', oi.variants::json
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'
             ) as items 
      FROM orders 
      LEFT JOIN orders_items oi ON orders.id = oi.order_id
      ${whereClause}
      GROUP BY orders.id
      ORDER BY orders.created_at DESC
    `

    const summaryQuery = `
      SELECT 
        COALESCE(SUM(grand_total), 0) as total_sales,
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN payment_method = 'CASH' THEN 1 END) as cash_count,
        COUNT(CASE WHEN payment_method = 'QRIS' THEN 1 END) as qris_count
      FROM orders
      ${whereClause}
    `

    const [transactionsRes, summaryRes] = await Promise.all([
      pool.query(transactionsQuery, params),
      pool.query(summaryQuery, params),
    ])

    const transactions = transactionsRes.rows
    const summary = summaryRes.rows[0]

    return NextResponse.json({
      summary: {
        total_sales: parseInt(summary?.total_sales || '0'),
        total_transactions: parseInt(summary?.total_transactions || '0'),
        cash_count: parseInt(summary?.cash_count || '0'),
        qris_count: parseInt(summary?.qris_count || '0'),
      },
      transactions: transactions,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
