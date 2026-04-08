import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'

type TrendRow = {
  date: string
  revenue: number
  payments: number
}

function toNumber(value: unknown) {
  return Number(value || 0)
}

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitIdParam = searchParams.get('unitId')
    const days = Math.min(60, Math.max(7, Number(searchParams.get('days') || 14)))
    const asOfDateParam = searchParams.get('asOfDate')

    let unitScope: number | null = null
    if (unitIdParam && unitIdParam.trim() !== '') {
      const parsedUnit = Number(unitIdParam)
      if (!Number.isFinite(parsedUnit) || parsedUnit <= 0) {
        return NextResponse.json({ error: 'unitId must be a positive number' }, { status: 400 })
      }
      if (!canAccessUnit(auth, parsedUnit)) {
        return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
      }
      unitScope = parsedUnit
    } else if (auth.unitId) {
      unitScope = auth.unitId
    }

    const asOfDate = asOfDateParam && asOfDateParam.trim() !== '' ? asOfDateParam.trim() : new Date().toISOString().slice(0, 10)
    const rangeStart = new Date(asOfDate)
    rangeStart.setDate(rangeStart.getDate() - (days - 1))
    const fromDate = rangeStart.toISOString().slice(0, 10)

    const pool = await getDb()

    const revenueTodayQuery = `
      SELECT COALESCE(SUM(o.grand_total), 0)::bigint AS value
      FROM orders o
      WHERE DATE(o.created_at AT TIME ZONE 'Asia/Jakarta') = $1::date
        AND o.payment_status = 'PAID'
        AND COALESCE(o.description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
        ${unitScope ? 'AND o.unit_id = $2' : ''}
    `

    const arOutstandingQuery = `
      SELECT COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)::bigint AS value
      FROM invoices i
      WHERE i.deleted_at IS NULL
        ${unitScope ? 'AND i.unit_id = $1' : ''}
    `

    const cashPositionQuery = `
      SELECT COALESCE(SUM(jl.debit - jl.kredit), 0)::bigint AS value
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl.journal_entry_id
      WHERE je.deleted_at IS NULL
        AND je.transaction_date <= $1::date
        AND jl.account_code IN ('1001', '1002', '1003', '1101', '1102', '1103')
        ${unitScope ? 'AND je.unit_id = $2' : ''}
    `

    const occupancyQuery = `
      WITH base AS (
        SELECT
          COUNT(DISTINCT CASE WHEN f.check_in_date <= $1::date AND f.check_out_date > $1::date AND f.status = 'OPEN' THEN f.room_number END)::int AS occupied_rooms,
          COUNT(DISTINCT f.room_number)::int AS known_rooms
        FROM folios f
        WHERE f.deleted_at IS NULL
          ${unitScope ? 'AND f.unit_id = $2' : ''}
      )
      SELECT
        occupied_rooms,
        known_rooms,
        CASE WHEN known_rooms = 0 THEN 0 ELSE ROUND((occupied_rooms::numeric / known_rooms::numeric) * 100, 2) END AS occupancy_rate
      FROM base
    `

    const trendQuery = `
      WITH dates AS (
        SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day
      ),
      revenue AS (
        SELECT
          DATE(o.created_at AT TIME ZONE 'Asia/Jakarta') AS day,
          COALESCE(SUM(o.grand_total), 0)::bigint AS revenue
        FROM orders o
        WHERE DATE(o.created_at AT TIME ZONE 'Asia/Jakarta') BETWEEN $1::date AND $2::date
          AND o.payment_status = 'PAID'
          AND COALESCE(o.description, '') NOT LIKE 'PETTY_CASH_SENTINEL%'
          ${unitScope ? 'AND o.unit_id = $3' : ''}
        GROUP BY DATE(o.created_at AT TIME ZONE 'Asia/Jakarta')
      ),
      payments AS (
        SELECT
          p.payment_date::date AS day,
          COALESCE(SUM(p.amount), 0)::bigint AS payments
        FROM payments p
        WHERE p.deleted_at IS NULL
          AND p.payment_date BETWEEN $1::date AND $2::date
          ${unitScope ? 'AND p.unit_id = $3' : ''}
        GROUP BY p.payment_date::date
      )
      SELECT
        d.day::text AS date,
        COALESCE(r.revenue, 0)::bigint AS revenue,
        COALESCE(py.payments, 0)::bigint AS payments
      FROM dates d
      LEFT JOIN revenue r ON r.day = d.day
      LEFT JOIN payments py ON py.day = d.day
      ORDER BY d.day ASC
    `

    const overdueAlertsQuery = `
      SELECT
        cla.account_name,
        cla.account_code,
        COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)::bigint AS outstanding_amount,
        COALESCE(MAX(($1::date - i.due_date::date)), 0)::int AS max_days_overdue
      FROM invoices i
      JOIN city_ledger_accounts cla ON cla.id = i.city_ledger_account_id
      WHERE i.deleted_at IS NULL
        AND i.due_date < $1::date
        AND (i.total_amount - i.paid_amount) > 0
        ${unitScope ? 'AND i.unit_id = $2' : ''}
      GROUP BY cla.id, cla.account_name, cla.account_code
      ORDER BY outstanding_amount DESC, max_days_overdue DESC
      LIMIT 5
    `

    const creditAlertCountQuery = `
      SELECT COUNT(*)::int AS value
      FROM (
        SELECT
          cla.id,
          CASE
            WHEN cla.credit_limit <= 0 THEN 0
            ELSE ROUND((COALESCE(SUM(GREATEST(i.total_amount - i.paid_amount, 0)), 0)::numeric / cla.credit_limit::numeric) * 100, 2)
          END AS utilization_percent
        FROM city_ledger_accounts cla
        LEFT JOIN invoices i ON i.city_ledger_account_id = cla.id AND i.deleted_at IS NULL
        WHERE cla.deleted_at IS NULL
          ${unitScope ? 'AND cla.unit_id = $1' : ''}
        GROUP BY cla.id, cla.credit_limit
      ) x
      WHERE x.utilization_percent >= 80
    `

    const revenueTodayParams = unitScope ? [asOfDate, unitScope] : [asOfDate]
    const arOutstandingParams = unitScope ? [unitScope] : []
    const cashPositionParams = unitScope ? [asOfDate, unitScope] : [asOfDate]
    const occupancyParams = unitScope ? [asOfDate, unitScope] : [asOfDate]
    const trendParams = unitScope ? [fromDate, asOfDate, unitScope] : [fromDate, asOfDate]
    const overdueAlertsParams = unitScope ? [asOfDate, unitScope] : [asOfDate]
    const creditAlertCountParams = unitScope ? [unitScope] : []

    const [
      revenueTodayRes,
      arOutstandingRes,
      cashPositionRes,
      occupancyRes,
      trendRes,
      overdueAlertsRes,
      creditAlertCountRes,
    ] = await Promise.all([
      pool.query(revenueTodayQuery, revenueTodayParams),
      pool.query(arOutstandingQuery, arOutstandingParams),
      pool.query(cashPositionQuery, cashPositionParams),
      pool.query(occupancyQuery, occupancyParams),
      pool.query(trendQuery, trendParams),
      pool.query(overdueAlertsQuery, overdueAlertsParams),
      pool.query(creditAlertCountQuery, creditAlertCountParams),
    ])

    const trendRows = trendRes.rows as TrendRow[]
    const trendRevenueTotal = trendRows.reduce((sum, row) => sum + toNumber(row.revenue), 0)
    const trendPaymentsTotal = trendRows.reduce((sum, row) => sum + toNumber(row.payments), 0)

    const overdueCountQuery = `
      SELECT COUNT(*)::int AS value
      FROM invoices i
      WHERE i.deleted_at IS NULL
        AND i.due_date < $1::date
        AND (i.total_amount - i.paid_amount) > 0
        ${unitScope ? 'AND i.unit_id = $2' : ''}
    `
    const overdueCountParams = unitScope ? [asOfDate, unitScope] : [asOfDate]
    const overdueCountRes = await pool.query(overdueCountQuery, overdueCountParams)

    return NextResponse.json({
      scope: {
        unitId: unitScope,
        asOfDate,
        fromDate,
        days,
      },
      kpis: {
        revenueToday: toNumber(revenueTodayRes.rows[0]?.value),
        arOutstanding: toNumber(arOutstandingRes.rows[0]?.value),
        cashPosition: toNumber(cashPositionRes.rows[0]?.value),
        occupancyRate: toNumber(occupancyRes.rows[0]?.occupancy_rate),
        occupiedRooms: toNumber(occupancyRes.rows[0]?.occupied_rooms),
        knownRooms: toNumber(occupancyRes.rows[0]?.known_rooms),
        overdueInvoices: toNumber(overdueCountRes.rows[0]?.value),
        creditAlerts: toNumber(creditAlertCountRes.rows[0]?.value),
      },
      trend: {
        rows: trendRows,
        totals: {
          revenue: trendRevenueTotal,
          payments: trendPaymentsTotal,
        },
      },
      overdueFocus: overdueAlertsRes.rows,
    })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
