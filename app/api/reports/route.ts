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

    let whereClause = "WHERE DATE(orders.created_at) = $1 AND orders.payment_status != 'VOID'"
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
             ) as items,
             COALESCE(SUM(oi.qty), 0) as item_count
      FROM orders 
      LEFT JOIN orders_items oi ON orders.id = oi.order_id
      ${whereClause}
      GROUP BY orders.id
      ORDER BY orders.created_at DESC
    `

    const summaryQuery = `
      SELECT 
        COALESCE(SUM(o.grand_total), 0) as total_sales,
        COUNT(*) as total_transactions,
        COALESCE(SUM(sub.total_cogs), 0) as total_cogs
      FROM orders o
      LEFT JOIN (
        SELECT oi.order_id, SUM(COALESCE(p.cogs, 0) * oi.qty) as total_cogs
        FROM orders_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        GROUP BY oi.order_id
      ) sub ON o.id = sub.order_id
      ${whereClause.replace(/orders\./g, 'o.')}
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
        total_cogs: parseInt(summary?.total_cogs || '0'),
      },
      transactions: transactions,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
