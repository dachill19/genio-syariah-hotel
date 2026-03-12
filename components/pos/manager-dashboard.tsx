'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatRupiah, cn } from '@/lib/utils'
import {
  TrendingUp,
  Receipt,
  PiggyBank,
  Target,
  Calendar,
  BarChart3,
  Crown,
  CreditCard,
  Banknote,
  QrCode,
  ShoppingBag,
  UtensilsCrossed,
  Eye,
  Package,
} from 'lucide-react'
import { ReceiptViewDialog } from '@/components/pos/receipt-view-dialog'
import { Button } from '@/components/ui/button'

interface ManagerDashboardProps {
  unitId: number
}

type DatePreset = 'today' | 'week' | 'month' | 'custom'

// Use local date formatting instead of toISOString() which returns UTC
const getLocalDateStr = (d: Date) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const getToday = () => getLocalDateStr(new Date())

const getPresetDates = (preset: DatePreset): { start: string; end: string } => {
  const today = new Date()
  const end = getLocalDateStr(today)

  switch (preset) {
    case 'today':
      return { start: end, end }
    case 'week': {
      const day = today.getDay()
      const diff = day === 0 ? 6 : day - 1
      const monday = new Date(today)
      monday.setDate(today.getDate() - diff)
      return { start: getLocalDateStr(monday), end }
    }
    case 'month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      return { start: getLocalDateStr(firstDay), end }
    }
    default:
      return { start: end, end }
  }
}

const PRESET_OPTIONS: { key: DatePreset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
]

export const getPaymentBadgeConfig = (method: string) => {
  switch (method) {
    case 'CASH':
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', bar: 'bg-emerald-400', icon: Banknote }
    case 'QRIS':
      return { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-400', icon: QrCode }
    case 'CARD':
      return { bg: 'bg-violet-100', text: 'text-violet-700', bar: 'bg-violet-400', icon: CreditCard }
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground', bar: 'bg-muted-foreground/60', icon: Banknote }
  }
}

export const getOrderTypeBadgeConfig = (type: string) => {
  switch (type) {
    case 'Dine in':
      return { bg: 'bg-orange-100', text: 'text-orange-700', icon: UtensilsCrossed }
    case 'Take Away':
      return { bg: 'bg-primary/20', text: 'text-primary', icon: ShoppingBag }
    default:
      return { bg: 'bg-muted', text: 'text-muted-foreground', icon: Package }
  }
}

const PAYMENT_ICON: Record<string, any> = {
  CASH: Banknote,
  QRIS: QrCode,
  CARD: CreditCard,
}

const PAYMENT_COLOR: Record<string, string> = {
  CASH: 'text-emerald-600',
  QRIS: 'text-violet-600',
  CARD: 'text-blue-600',
}

export function ManagerDashboard({ unitId }: ManagerDashboardProps) {
  const [preset, setPreset] = useState<DatePreset>('month')
  const [startDate, setStartDate] = useState(() => getPresetDates('month').start)
  const [endDate, setEndDate] = useState(getToday())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const chartRef = useRef<HTMLCanvasElement>(null)

  // Dialog State
  const [selectedTx, setSelectedTx] = useState<any>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)

  const handlePresetChange = (p: DatePreset) => {
    setPreset(p)
    if (p !== 'custom') {
      const { start, end } = getPresetDates(p)
      setStartDate(start)
      setEndDate(end)
    }
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}&unitId=${unitId}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [startDate, endDate, unitId])

  useEffect(() => {
    if (!data?.dailySales?.length || !chartRef.current) return
    drawChart(chartRef.current, data.dailySales)
  }, [data])

  const summary = data?.summary || { total_sales: 0, total_transactions: 0, total_cogs: 0 }
  const totalSales = summary.total_sales
  const totalTx = summary.total_transactions
  const grossProfit = totalSales - summary.total_cogs
  const aov = totalTx > 0 ? Math.round(totalSales / totalTx) : 0
  const profitMargin = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(1) : '0'

  const getPeriodLabel = () => {
    if (startDate === endDate) {
      return new Date(startDate).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    }
    const fmt = (d: string) =>
      new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
    return `${fmt(startDate)} — ${fmt(endDate)}`
  }

  const kpiCards = [
    {
      title: 'Total Sales',
      value: formatRupiah(totalSales),
      subtitle: `${totalTx} orders`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'from-emerald-50 to-green-50/30',
      bgIcon: 'bg-emerald-100',
    },
    {
      title: 'Total Transactions',
      value: totalTx,
      subtitle: `Avg ${formatRupiah(aov)} / order`,
      icon: Receipt,
      color: 'text-blue-600',
      bg: 'from-blue-50 to-indigo-50/30',
      bgIcon: 'bg-blue-100',
    },
    {
      title: 'Gross Profit',
      value: formatRupiah(grossProfit),
      subtitle: `${profitMargin}% margin`,
      icon: PiggyBank,
      color: 'text-amber-600',
      bg: 'from-amber-50 to-yellow-50/30',
      bgIcon: 'bg-amber-100',
    },
    {
      title: 'Avg. Order Value',
      value: formatRupiah(aov),
      subtitle: totalTx > 0 ? `From ${totalTx} orders` : 'No orders yet',
      icon: Target,
      color: 'text-violet-600',
      bg: 'from-violet-50 to-purple-50/30',
      bgIcon: 'bg-violet-100',
    },
  ]

  return (
    <div className="bg-background flex h-screen flex-col overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              <BarChart3 className="text-primary h-6 w-6" />
            </div>
            Manager Dashboard
          </h1>
          <p className="text-muted-foreground mt-1.5 ml-14 text-sm">
            {getPeriodLabel()} — {totalTx} transactions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-muted/40 flex rounded-xl p-1">
            {PRESET_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handlePresetChange(opt.key)}
                className={cn(
                  'rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                  preset === opt.key
                    ? 'bg-primary/10 text-primary font-bold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Calendar className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-card w-auto rounded-xl pl-9"
                />
              </div>
              <span className="text-muted-foreground text-sm">to</span>
              <div className="relative">
                <Calendar className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-card w-auto rounded-xl pl-9"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            {kpiCards.map((card) => (
              <Card
                key={card.title}
                className={cn('overflow-hidden border bg-linear-to-br', card.bg)}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                      {card.title}
                    </p>
                    <div
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl',
                        card.bgIcon,
                      )}
                    >
                      <card.icon className={cn('h-5 w-5', card.color)} />
                    </div>
                  </div>
                  <p className={cn('mt-2 text-2xl font-bold', card.color)}>{card.value}</p>
                  <p className="text-muted-foreground mt-1 text-xs">{card.subtitle}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Chart + Top Products */}
          <div className="grid grid-cols-5 gap-4">
            {/* Sales Chart */}
            <Card className="col-span-3 border">
              <CardContent className="p-5">
                <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-bold">
                  <BarChart3 className="h-4 w-4" />
                  Sales Trend
                </h3>
                {data?.dailySales?.length > 0 ? (
                  <canvas ref={chartRef} className="h-64 w-full" />
                ) : (
                  <div className="flex h-64 items-center justify-center">
                    <p className="text-muted-foreground text-sm">No sales data for this period</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Products */}
            <Card className="col-span-2 border">
              <CardContent className="p-5">
                <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-bold">
                  <Crown className="h-4 w-4 text-amber-500" />
                  Top Products
                </h3>
                <div className="space-y-3">
                  {(data?.topProducts || []).length === 0 ? (
                    <p className="text-muted-foreground py-8 text-center text-sm">No data</p>
                  ) : (
                    data.topProducts.slice(0, 8).map((p: any, i: number) => (
                      <div key={p.name} className="flex items-center gap-3">
                        <span
                          className={cn(
                            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold',
                            i === 0
                              ? 'bg-amber-100 text-amber-700'
                              : i === 1
                                ? 'bg-slate-100 text-slate-600'
                                : i === 2
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-foreground truncate text-sm font-medium">{p.name}</p>
                          <p className="text-muted-foreground text-xs">{p.qty} sold</p>
                        </div>
                        <span className="text-foreground shrink-0 text-sm font-semibold">
                          {formatRupiah(p.revenue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment & Order Type Breakdown */}
          <div className="grid grid-cols-5 gap-4">
            {/* Payment Breakdown */}
            <Card className="col-span-3 border">
              <CardContent className="p-5">
                <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-bold">
                  <CreditCard className="h-4 w-4" />
                  Payment Methods
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {['CASH', 'QRIS', 'CARD'].map((method) => {
                    const item = (data?.paymentBreakdown || []).find(
                      (p: any) => p.method === method,
                    )
                    const count = item?.count || 0
                    const total = item?.total || 0
                    const pct = totalTx > 0 ? ((count / totalTx) * 100).toFixed(0) : '0'
                    const Icon = PAYMENT_ICON[method] || CreditCard

                    return (
                      <div key={method} className="bg-muted/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', PAYMENT_COLOR[method])} />
                            <span className="text-foreground text-sm font-bold">{method}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">{pct}%</span>
                        </div>
                        <p className={cn('mt-2 text-lg font-bold', PAYMENT_COLOR[method])}>
                          {formatRupiah(total)}
                        </p>
                        <p className="text-muted-foreground text-xs">{count} transactions</p>
                        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              method === 'CASH'
                                ? 'bg-emerald-500'
                                : method === 'QRIS'
                                  ? 'bg-violet-500'
                                  : 'bg-blue-500',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Order Type */}
            <Card className="col-span-2 border">
              {' '}
              {/* Tambahkan col-span-2 di sini */}
              <CardContent className="p-5">
                <h3 className="text-foreground mb-4 flex items-center gap-2 text-sm font-bold">
                  <ShoppingBag className="h-4 w-4" />
                  Order Types
                </h3>
                {/* UBAH space-y-4 MENJADI grid grid-cols-2 gap-4 */}
                <div className="grid grid-cols-2 gap-4">
                  {['Dine in', 'Takeaway'].map((type) => {
                    const item = (data?.orderTypeBreakdown || []).find(
                      (ot: any) => ot.type === type,
                    )
                    const count = item?.count || 0
                    const total = item?.total || 0
                    const pct = totalTx > 0 ? ((count / totalTx) * 100).toFixed(0) : '0'
                    const isDine = type === 'Dine in'

                    return (
                      <div key={type} className="bg-muted/30 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isDine ? (
                              <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                            ) : (
                              <ShoppingBag className="text-primary h-4 w-4" />
                            )}
                            <span className="text-foreground text-sm font-bold">{type}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">{pct}%</span>
                        </div>
                        <p
                          className={cn(
                            'mt-2 text-lg font-bold',
                            isDine ? 'text-orange-600' : 'text-primary',
                          )}
                        >
                          {formatRupiah(total)}
                        </p>
                        <p className="text-muted-foreground text-xs">{count} orders</p>
                        <div className="bg-muted mt-2 h-1.5 overflow-hidden rounded-full">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              isDine ? 'bg-orange-500' : 'bg-primary',
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transactions Table */}
          <Card className="border">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div className="flex items-center gap-2">
                  <Receipt className="text-primary h-4 w-4" />
                  <h3 className="text-foreground text-sm font-bold">Sales History</h3>
                </div>
                <span className="text-muted-foreground text-xs">
                  Showing 10 recent transactions
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-5 py-3 font-semibold tracking-wider">Date & Time</th>
                      <th className="px-5 py-3 font-semibold tracking-wider">Invoice</th>
                      <th className="px-5 py-3 font-semibold tracking-wider">Type</th>
                      <th className="px-5 py-3 font-semibold tracking-wider">Payment</th>
                      <th className="px-5 py-3 font-semibold tracking-wider">Cashier</th>
                      <th className="px-5 py-3 text-right font-semibold tracking-wider">Total</th>
                      <th className="px-5 py-3 text-center font-semibold tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {data?.recentTransactions?.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-muted-foreground px-5 py-8 text-center">
                          No recent transactions found
                        </td>
                      </tr>
                    ) : (
                      (data?.recentTransactions || []).map((tx: any) => {
                        const PaymentIcon = getPaymentBadgeConfig(tx.payment_method || '').icon
                        const TypeIcon = getOrderTypeBadgeConfig(tx.order_type || '').icon
                        const paymentConfig = getPaymentBadgeConfig(tx.payment_method || '')
                        const typeConfig = getOrderTypeBadgeConfig(tx.order_type || '')

                        return (
                          <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                            <td className="text-muted-foreground px-5 py-3 font-mono text-[13px]">
                              {new Date(tx.created_at).toLocaleString('id-ID', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })}
                            </td>
                            <td className="text-foreground px-5 py-3 font-mono font-medium">
                              {tx.invoice_number}
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase',
                                  typeConfig.bg,
                                  typeConfig.text
                                )}
                              >
                                <TypeIcon className="h-3 w-3" />
                                {tx.order_type || '-'}
                              </span>
                            </td>
                            <td className="px-5 py-3">
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase',
                                  paymentConfig.bg,
                                  paymentConfig.text
                                )}
                              >
                                <PaymentIcon className="h-3 w-3" />
                                {tx.payment_method}
                              </span>
                            </td>
                          <td className="text-muted-foreground px-5 py-3 text-[13px] font-medium">
                            {tx.cashier_name || '-'}
                          </td>
                          <td className="text-foreground px-5 py-3 text-right font-bold">
                            {formatRupiah(tx.grand_total)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                // Since we only get partial tx data from analytics endpoint,
                                // we mock the items array to render the base receipt
                                setSelectedTx({
                                  ...tx,
                                  items: [],
                                  unit_id: unitId,
                                })
                                setIsReceiptOpen(true)
                              }}
                              className="h-8 w-8 rounded-lg"
                              title="View Receipt"
                            >
                              <Eye className="text-muted-foreground hover:text-foreground h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Receipt Dialog */}
      <ReceiptViewDialog
        order={selectedTx}
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false)
          setSelectedTx(null)
        }}
      />
    </div>
  )
}

function drawChart(canvas: HTMLCanvasElement, dailySales: any[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  ctx.scale(dpr, dpr)

  const W = rect.width
  const H = rect.height
  const padL = 70
  const padR = 20
  const padT = 10
  const padB = 40

  ctx.clearRect(0, 0, W, H)

  const revenues = dailySales.map((d) => d.revenue)
  const maxRev = Math.max(...revenues, 1)

  const chartW = W - padL - padR
  const chartH = H - padT - padB
  const barW = Math.max(8, Math.min(40, chartW / dailySales.length - 6))

  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  const gridLines = 5
  for (let i = 0; i <= gridLines; i++) {
    const y = padT + (chartH / gridLines) * i
    ctx.beginPath()
    ctx.moveTo(padL, y)
    ctx.lineTo(W - padR, y)
    ctx.stroke()

    const val = maxRev - (maxRev / gridLines) * i
    ctx.fillStyle = '#9ca3af'
    ctx.font = '11px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(formatCompact(val), padL - 8, y + 4)
  }

  const primaryRaw = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
  const barColor = primaryRaw ? `hsl(${primaryRaw})` : '#10b981'
  const barColorFaded = primaryRaw ? `hsl(${primaryRaw} / 0.25)` : '#10b98140'

  dailySales.forEach((d, i) => {
    const x = padL + (chartW / dailySales.length) * i + (chartW / dailySales.length - barW) / 2
    const h = (d.revenue / maxRev) * chartH
    const y = padT + chartH - h

    const gradient = ctx.createLinearGradient(x, y, x, padT + chartH)
    gradient.addColorStop(0, barColor)
    gradient.addColorStop(1, barColorFaded)
    ctx.fillStyle = gradient

    const radius = Math.min(4, barW / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + barW - radius, y)
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius)
    ctx.lineTo(x + barW, padT + chartH)
    ctx.lineTo(x, padT + chartH)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.fill()

    ctx.fillStyle = '#6b7280'
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    const date = new Date(d.date)
    const label = `${date.getDate()}/${date.getMonth() + 1}`
    ctx.fillText(label, x + barW / 2, H - padB + 16)
  })
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}
