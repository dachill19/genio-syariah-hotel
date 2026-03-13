import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const TZ = 'Asia/Jakarta'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')
  const unitId = searchParams.get('unitId')

  if (!startDate || !endDate || !unitId) {
    return NextResponse.json({ error: 'startDate, endDate, and unitId are required' }, { status: 400 })
  }

  try {
    const pool = await getDb()
    const isSingleDay = startDate === endDate

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
      WHERE DATE(o.created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
        AND o.unit_id = $3
        AND o.payment_status = 'PAID'
        AND COALESCE(o.description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
    `

    const dailySalesQuery = isSingleDay
      ? `
          SELECT
            DATE(created_at AT TIME ZONE '${TZ}') as date,
            EXTRACT(HOUR FROM created_at AT TIME ZONE '${TZ}')::int as hour,
            TO_CHAR(DATE_TRUNC('hour', created_at AT TIME ZONE '${TZ}'), 'HH24:00') as label,
            COALESCE(SUM(grand_total), 0) as revenue,
            COUNT(*) as orders
          FROM orders
          WHERE DATE(created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
            AND unit_id = $3
            AND payment_status = 'PAID'
            AND COALESCE(description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
          GROUP BY DATE(created_at AT TIME ZONE '${TZ}'), EXTRACT(HOUR FROM created_at AT TIME ZONE '${TZ}'), DATE_TRUNC('hour', created_at AT TIME ZONE '${TZ}')
          ORDER BY hour ASC
        `
      : `
          SELECT DATE(created_at AT TIME ZONE '${TZ}') as date,
                 COALESCE(SUM(grand_total), 0) as revenue,
                 COUNT(*) as orders
          FROM orders
          WHERE DATE(created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
            AND unit_id = $3
            AND payment_status = 'PAID'
            AND COALESCE(description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
          GROUP BY DATE(created_at AT TIME ZONE '${TZ}')
          ORDER BY date ASC
        `

    const topProductsQuery = `
      SELECT oi.name,
             SUM(oi.qty) as total_qty,
             SUM(oi.total_price * oi.qty) as total_revenue
      FROM orders_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
        AND o.unit_id = $3
        AND o.payment_status = 'PAID'
        AND COALESCE(o.description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
      GROUP BY oi.name
      ORDER BY total_qty DESC
      LIMIT 10
    `

    const paymentBreakdownQuery = `
      SELECT payment_method,
             COUNT(*) as count,
             COALESCE(SUM(grand_total), 0) as total
      FROM orders
      WHERE DATE(created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
        AND unit_id = $3
        AND payment_status = 'PAID'
        AND COALESCE(description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
      GROUP BY payment_method
    `

    const orderTypeQuery = `
      SELECT order_type,
             COUNT(*) as count,
             COALESCE(SUM(grand_total), 0) as total
      FROM orders
      WHERE DATE(created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
        AND unit_id = $3
        AND payment_status = 'PAID'
        AND COALESCE(description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
      GROUP BY order_type
    `

    const recentTransactionsQuery = `
      SELECT id, invoice_number, created_at, customer_name, order_type, payment_method, payment_status, grand_total, cashier_name
      FROM orders
      WHERE DATE(created_at AT TIME ZONE '${TZ}') BETWEEN $1 AND $2
        AND unit_id = $3
        AND payment_status IN ('PAID', 'CANCELLED', 'UNPAID')
        AND COALESCE(description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
      ORDER BY created_at DESC
      LIMIT 10
    `

    const params = [startDate, endDate, unitId]

    const [summaryRes, dailyRes, topRes, paymentRes, orderTypeRes, recentRes] = await Promise.all([
      pool.query(summaryQuery, params),
      pool.query(dailySalesQuery, params),
      pool.query(topProductsQuery, params),
      pool.query(paymentBreakdownQuery, params),
      pool.query(orderTypeQuery, params),
      pool.query(recentTransactionsQuery, params),
    ])

    const summary = summaryRes.rows[0]

    return NextResponse.json({
      summary: {
        total_sales: parseInt(summary?.total_sales || '0'),
        total_transactions: parseInt(summary?.total_transactions || '0'),
        total_cogs: parseInt(summary?.total_cogs || '0'),
      },
      dailySales: dailyRes.rows.map((r: any) => ({
        date: r.date,
        label: r.label || null,
        revenue: parseInt(r.revenue),
        orders: parseInt(r.orders),
      })),
      topProducts: topRes.rows.map((r: any) => ({
        name: r.name,
        qty: parseInt(r.total_qty),
        revenue: parseInt(r.total_revenue),
      })),
      paymentBreakdown: paymentRes.rows.map((r: any) => ({
        method: r.payment_method,
        count: parseInt(r.count),
        total: parseInt(r.total),
      })),
      orderTypeBreakdown: orderTypeRes.rows.map((r: any) => ({
        type: r.order_type,
        count: parseInt(r.count),
        total: parseInt(r.total),
      })),
      recentTransactions: recentRes.rows.map((r: any) => ({
        id: r.id,
        invoice_number: r.invoice_number,
        created_at: r.created_at,
        customer_name: r.customer_name,
        order_type: r.order_type,
        payment_method: r.payment_method,
        payment_status: r.payment_status,
        grand_total: parseInt(r.grand_total),
        cashier_name: r.cashier_name,
      })),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
