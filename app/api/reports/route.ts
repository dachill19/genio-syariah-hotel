import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')
  const cashierName = searchParams.get('cashierName')

  if (!unitId || !cashierName) {
    return NextResponse.json({ error: 'unitId and cashierName are required' }, { status: 400 })
  }

  try {
    const pool = await getDb()

    // Use timezone-aware date: convert to Asia/Jakarta (UTC+7) to get the correct local date
    const now = new Date()
    const today = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const baseWhere = `WHERE DATE(orders.created_at AT TIME ZONE 'Asia/Jakarta') = $1 AND orders.unit_id = $2 AND orders.cashier_name = $3`
    const transactionWhereClause = `${baseWhere} AND orders.payment_status IN ('PAID', 'CANCELLED')`
    const summaryWhereClause = `${baseWhere} AND orders.payment_status = 'PAID'`
    const params = [today, unitId, cashierName]

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
      ${transactionWhereClause}
      GROUP BY orders.id
      ORDER BY orders.created_at DESC
    `

    const summaryQuery = `
      SELECT 
       COALESCE(SUM(orders.grand_total), 0) as total_sales,
       COUNT(*) as total_transactions,
       COALESCE(SUM(
         (SELECT SUM(qty) FROM orders_items WHERE order_id = orders.id)
       ), 0) as total_items_sold
      FROM orders
      ${summaryWhereClause}
    `

    const [transactionsRes, summaryRes] = await Promise.all([
      pool.query(transactionsQuery, params),
      pool.query(summaryQuery, params),
    ])

    const transactions = transactionsRes.rows
    const summary = summaryRes.rows[0]

    // Note: No COGS or profit margin is returned here anymore as per security requirement for cashiers
    return NextResponse.json({
      summary: {
        total_sales: parseInt(summary?.total_sales || '0'),
        total_transactions: parseInt(summary?.total_transactions || '0'),
        total_items_sold: parseInt(summary?.total_items_sold || '0'),
      },
      transactions: transactions,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
