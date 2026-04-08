'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, AlertTriangle, Banknote, Building2, CalendarClock, ChartLine, CreditCard, Hotel, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

type DashboardPayload = {
  scope: {
    unitId: number | null
    asOfDate: string
    fromDate: string
    days: number
  }
  kpis: {
    revenueToday: number
    arOutstanding: number
    cashPosition: number
    occupancyRate: number
    occupiedRooms: number
    knownRooms: number
    overdueInvoices: number
    creditAlerts: number
  }
  trend: {
    rows: Array<{
      date: string
      revenue: number
      payments: number
    }>
    totals: {
      revenue: number
      payments: number
    }
  }
  overdueFocus: Array<{
    account_name: string
    account_code: string
    outstanding_amount: number
    max_days_overdue: number
  }>
}

const money = new Intl.NumberFormat('id-ID')

function toCompactCurrency(value: number) {
  if (value >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(1)}K`
  return `Rp ${money.format(value)}`
}

function getTrendPolyline(values: number[], width: number, height: number) {
  if (!values.length) return ''
  const max = Math.max(...values, 1)
  const step = values.length > 1 ? width / (values.length - 1) : width

  return values
    .map((value, index) => {
      const x = index * step
      const y = height - (value / max) * height
      return `${x},${y}`
    })
    .join(' ')
}

export default function FinancePage() {
  const [unitId, setUnitId] = useState('')
  const [days, setDays] = useState('14')
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [payload, setPayload] = useState<DashboardPayload | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')

    const query = new URLSearchParams()
    if (unitId.trim()) query.set('unitId', unitId.trim())
    if (days.trim()) query.set('days', days.trim())
    if (asOfDate.trim()) query.set('asOfDate', asOfDate.trim())

    const res = await fetch(`/api/finance/dashboard?${query.toString()}`)
    const data = await res.json()

    if (!res.ok) {
      setError(String(data?.error || 'Failed to load finance dashboard'))
      setPayload(null)
      setLoading(false)
      return
    }

    setPayload(data)
    setLoading(false)
  }, [asOfDate, days, unitId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadDashboard])

  const trendValues = useMemo(() => {
    const rows = payload?.trend.rows || []
    return rows.map((row) => Number(row.revenue || 0))
  }, [payload])

  const trendPolyline = useMemo(() => getTrendPolyline(trendValues, 640, 180), [trendValues])

  const trendBars = payload?.trend.rows || []

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(22,163,74,0.18),transparent_38%),radial-gradient(circle_at_100%_0%,rgba(14,116,144,0.16),transparent_42%),linear-gradient(180deg,#f8fafc_0%,#ffffff_42%,#f7fee7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <section className="w-full space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-[0_20px_80px_-35px_rgba(2,132,199,0.4)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <Badge className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700" variant="secondary">
                Finance Control Center
              </Badge>
              <h1
                className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl"
                style={{ fontFamily: 'Space Grotesk, Manrope, Segoe UI, sans-serif' }}
              >
                Finance Dashboard
              </h1>
              <p className="max-w-2xl text-sm text-slate-600 sm:text-base">
                Monitor cash strength, receivables pressure, and property occupancy from one unified cockpit.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</p>
                <Input
                  value={unitId}
                  onChange={(event) => setUnitId(event.target.value)}
                  placeholder="All"
                  className="h-9 w-24 bg-white"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Range (days)</p>
                <Input
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  className="h-9 w-24 bg-white"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">As of date</p>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(event) => setAsOfDate(event.target.value)}
                  className="h-9 w-[170px] bg-white"
                />
              </div>
              <Button onClick={() => void loadDashboard()} disabled={loading} className="h-9">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="overflow-hidden border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Revenue Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900">{toCompactCurrency(Number(payload?.kpis.revenueToday || 0))}</p>
                <ChartLine className="h-5 w-5 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-amber-100 bg-gradient-to-br from-amber-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-amber-700">Outstanding AR</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900">{toCompactCurrency(Number(payload?.kpis.arOutstanding || 0))}</p>
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-cyan-100 bg-gradient-to-br from-cyan-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Cash Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900">{toCompactCurrency(Number(payload?.kpis.cashPosition || 0))}</p>
                <Banknote className="h-5 w-5 text-cyan-700" />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-sky-100 bg-gradient-to-br from-sky-50 to-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-sky-700">Occupancy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-2xl font-bold text-slate-900">{Number(payload?.kpis.occupancyRate || 0).toFixed(1)}%</p>
                <Hotel className="h-5 w-5 text-sky-700" />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {Number(payload?.kpis.occupiedRooms || 0)} of {Number(payload?.kpis.knownRooms || 0)} rooms
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <Card className="border-slate-200 bg-white/90">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-slate-600" />
                  Revenue and Receipts Trend
                </span>
                <Badge variant="outline">{payload?.scope.days || 14} days</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
                <svg viewBox="0 0 640 180" className="h-[180px] w-full">
                  <polyline
                    points={trendPolyline}
                    fill="none"
                    stroke="rgb(5 150 105)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="grid grid-cols-7 gap-2 sm:grid-cols-10">
                {trendBars.slice(Math.max(0, trendBars.length - 10)).map((row) => {
                  const max = Math.max(...trendBars.map((item) => Number(item.revenue || 0)), 1)
                  const height = Math.max(8, (Number(row.revenue || 0) / max) * 72)

                  return (
                    <div key={row.date} className="flex flex-col items-center gap-1">
                      <div className="flex h-20 w-5 items-end rounded-full bg-slate-100 p-1">
                        <div
                          className="w-full rounded-full bg-gradient-to-t from-emerald-500 to-emerald-300"
                          style={{ height: `${height}px` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500">{String(row.date).slice(5)}</p>
                    </div>
                  )
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Revenue Window</p>
                  <p className="text-lg font-semibold text-slate-900">Rp {money.format(Number(payload?.trend.totals.revenue || 0))}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Payments Window</p>
                  <p className="text-lg font-semibold text-slate-900">Rp {money.format(Number(payload?.trend.totals.payments || 0))}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/90">
              <CardHeader>
                <CardTitle className="text-base">Risk Radar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-amber-700">Overdue Invoices</p>
                    <p className="text-xl font-semibold text-slate-900">{Number(payload?.kpis.overdueInvoices || 0)}</p>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 p-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-rose-700">Credit Alerts</p>
                    <p className="text-xl font-semibold text-slate-900">{Number(payload?.kpis.creditAlerts || 0)}</p>
                  </div>
                  <Building2 className="h-5 w-5 text-rose-700" />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top Overdue Accounts</p>
                  {(payload?.overdueFocus || []).length === 0 && (
                    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No overdue exposure in this scope.</p>
                  )}
                  {(payload?.overdueFocus || []).map((row) => (
                    <div key={row.account_code} className="rounded-xl border border-slate-200 bg-white p-3">
                      <p className="text-sm font-semibold text-slate-900">{row.account_name}</p>
                      <p className="text-xs text-slate-500">{row.account_code}</p>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">Rp {money.format(Number(row.outstanding_amount || 0))}</span>
                        <Badge variant="outline" className="rounded-full">{Number(row.max_days_overdue || 0)} days</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-white/90">
              <CardHeader>
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/finance/reports">
                    Open Finance Reports
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/finance/general-ledger">
                    Open General Ledger
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link href="/finance/folios">
                    Manage Guest Folios
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild className="justify-between">
                  <Link href="/finance/night-audit">
                    Run Night Audit
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </section>
    </main>
  )
}
