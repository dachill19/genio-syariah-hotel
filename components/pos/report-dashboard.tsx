'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatRupiah, cn } from '@/lib/utils'
import {
  FileText,
  TrendingUp,
  BarChart3,
  Banknote,
  QrCode,
  CreditCard,
  Receipt,
  Package,
  Printer,
} from 'lucide-react'
import { Order } from '@/types/pos'
import { InvoiceModal } from '@/components/pos/invoice-modal'
import { useAuthStore } from '@/stores/auth-store'

interface ReportPageProps {
  unitId: number
}

const getPaymentBadgeConfig = (method: string) => {
  switch (method) {
    case 'CASH':
      return {
        bg: 'bg-emerald-100',
        text: 'text-emerald-700',
        bar: 'bg-emerald-400',
        icon: Banknote,
      }
    case 'QRIS':
      return { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-400', icon: QrCode }
    case 'CARD':
      return {
        bg: 'bg-violet-100',
        text: 'text-violet-700',
        bar: 'bg-violet-400',
        icon: CreditCard,
      }
    default:
      return {
        bg: 'bg-muted',
        text: 'text-muted-foreground',
        bar: 'bg-muted-foreground/60',
        icon: Banknote,
      }
  }
}

const getPaymentStatusStyle = (status: string) => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700'
    case 'UNPAID':
      return 'bg-amber-100 text-amber-700'
    case 'REFUNDED':
      return 'bg-blue-100 text-blue-700'
    case 'VOID':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function ReportDashboard({ unitId }: ReportPageProps) {
  const { user } = useAuthStore()
  const [summary, setSummary] = useState<any>(null)
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)

  const handlePrint = (order: Order) => {
    setSelectedOrder(order)
    setIsInvoiceOpen(true)
  }

  useEffect(() => {
    if (!user?.username) return

    setLoading(true)
    fetch(`/api/reports?unitId=${unitId}&cashierName=${encodeURIComponent(user.username)}`)
      .then((res) => res.json())
      .then((data) => {
        setSummary(data.summary)
        setTransactions(data.transactions)
      })
      .catch((err) => console.error('Failed to fetch reports', err))
      .finally(() => setLoading(false))
  }, [unitId, user?.username])

  const totalSales = summary?.total_sales || 0
  const totalTransactions = summary?.total_transactions || 0
  const totalItemsSold = summary?.total_items_sold || 0

  const paymentBreakdown = transactions.reduce(
    (acc: Record<string, { count: number; total: number }>, order: any) => {
      const method = order.payment_method || 'OTHER'
      if (!acc[method]) acc[method] = { count: 0, total: 0 }
      acc[method].count += 1
      acc[method].total += order.grand_total || 0
      return acc
    },
    {
      CASH: { count: 0, total: 0 },
      QRIS: { count: 0, total: 0 },
      CARD: { count: 0, total: 0 },
    } as Record<string, { count: number; total: number }>,
  )

  const summaryCards = [
    {
      title: 'Total Sales',
      value: formatRupiah(totalSales),
      subtitle: `${totalTransactions} orders today`,
      icon: TrendingUp,
      color: 'text-primary',
      bgAccent: 'bg-primary/10',
      gradient: 'from-emerald-50 to-green-50/30',
    },
    {
      title: 'Current Cash Drawer',
      value: formatRupiah(paymentBreakdown.CASH.total),
      subtitle: `From ${paymentBreakdown.CASH.count} cash payments`,
      icon: Banknote,
      color: 'text-emerald-600',
      bgAccent: 'bg-emerald-50',
      gradient: 'from-emerald-50 to-teal-50/30',
    },
    {
      title: 'Total Items Sold',
      value: totalItemsSold,
      subtitle: 'Across all orders today',
      icon: Package,
      color: 'text-orange-600',
      bgAccent: 'bg-orange-50',
      gradient: 'from-orange-50 to-amber-50/30',
    },
    {
      title: 'Total Transactions',
      value: totalTransactions,
      subtitle: 'Completed orders',
      icon: Receipt,
      color: 'text-blue-600',
      bgAccent: 'bg-blue-50',
      gradient: 'from-blue-50 to-indigo-50/30',
    },
  ]

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              <BarChart3 className="text-primary h-6 w-6" />
            </div>
            Sales Report
          </h1>
          <p className="text-muted-foreground mt-1.5 ml-14 text-sm">
            Current Shift ({user?.username || 'Cashier'}) —{' '}
            {new Date().toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card, index) => (
          <Card
            key={card.title}
            className="animate-slide-in-card overflow-hidden border-none shadow-sm"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className={cn('bg-linear-to-br', card.gradient)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  {card.title}
                </CardTitle>
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl shadow-sm',
                    card.bgAccent,
                  )}
                >
                  <card.icon className={cn('h-4.5 w-4.5', card.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={cn('text-2xl font-bold tracking-tight', card.color)}>
                  {card.value}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{card.subtitle}</p>
              </CardContent>
            </div>
          </Card>
        ))}
      </div>

      {/* Payment Breakdown */}
      {Object.keys(paymentBreakdown).length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          {Object.entries(paymentBreakdown)
            .filter(([method]) => method !== 'PENDING')
            .map(([method, data]) => {
              const config = getPaymentBadgeConfig(method)
              const PaymentIcon = config.icon
              const percentage =
                totalTransactions > 0 ? ((data.count / totalTransactions) * 100).toFixed(0) : '0'
              return (
                <div
                  key={method}
                  className="bg-card flex items-center gap-4 rounded-xl border p-4 shadow-sm"
                >
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      config.bg,
                    )}
                  >
                    <PaymentIcon className={cn('h-5 w-5', config.text)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{method}</span>
                      <span className="text-muted-foreground text-xs">{percentage}%</span>
                    </div>
                    <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          config.bar,
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="text-muted-foreground mt-1 flex justify-between text-[11px]">
                      <span>
                        {data.count} {data.count === 1 ? 'transaction' : 'transactions'}
                      </span>
                      <span className="font-medium">{formatRupiah(data.total)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-card flex flex-1 flex-col overflow-hidden rounded-2xl border shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm font-semibold">Recent Transactions</span>
          </div>
          <span className="bg-muted text-muted-foreground rounded-md px-2 py-0.5 text-xs font-medium">
            {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
          </span>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Loading...
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/30 sticky top-0 z-10">
                <tr className="border-b">
                  <th className="text-muted-foreground p-4 text-xs font-semibold tracking-wider uppercase">
                    Time
                  </th>
                  <th className="text-muted-foreground p-4 text-xs font-semibold tracking-wider uppercase">
                    Invoice
                  </th>
                  <th className="text-muted-foreground p-4 text-xs font-semibold tracking-wider uppercase">
                    Payment
                  </th>
                  <th className="text-muted-foreground p-4 text-xs font-semibold tracking-wider uppercase">
                    Status
                  </th>
                  <th className="text-muted-foreground p-4 text-right text-xs font-semibold tracking-wider uppercase">
                    Total
                  </th>
                  <th className="text-muted-foreground p-4 text-center text-xs font-semibold tracking-wider uppercase">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="border-border divide-y">
                {transactions.map((order, index) => {
                  const itemCount = parseInt(order.item_count || '0')
                  const paymentConfig = getPaymentBadgeConfig(order.payment_method)
                  const PaymentIcon = paymentConfig.icon
                  return (
                    <tr
                      key={order.invoice_number}
                      className="hover:bg-muted/30 animate-fade-in-up transition-colors"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="p-4">
                        <span className="bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs font-medium tabular-nums">
                          {new Date(order.created_at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-foreground text-sm font-semibold">
                          {order.invoice_number}
                        </div>
                        {itemCount > 0 && (
                          <div className="text-muted-foreground mt-0.5 text-[11px]">
                            {itemCount} {itemCount === 1 ? 'item' : 'items'}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold',
                            paymentConfig.bg,
                            paymentConfig.text,
                          )}
                        >
                          <PaymentIcon className="h-3 w-3" />
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-semibold',
                            getPaymentStatusStyle(order.payment_status || 'PAID'),
                          )}
                        >
                          {order.payment_status || 'PAID'}
                        </span>
                      </td>
                      <td className="text-foreground p-4 text-right text-sm font-bold tabular-nums">
                        {formatRupiah(order.grand_total)}
                      </td>
                      <td className="p-4 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Print Invoice"
                          onClick={() => handlePrint(order)}
                          className="h-8 w-8 rounded-lg"
                        >
                          <Printer className="text-muted-foreground hover:text-foreground h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {transactions.length === 0 && (
                  <tr className="h-full">
                    <td colSpan={6} className="p-16 text-center align-middle">
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-muted/50 flex h-16 w-16 items-center justify-center rounded-2xl">
                          <Receipt className="text-muted-foreground h-8 w-8" />
                        </div>
                        <div>
                          <p className="text-foreground font-semibold">No transactions found</p>
                          <p className="text-muted-foreground mt-0.5 text-sm">
                            Try selecting a different date
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <InvoiceModal
        order={selectedOrder}
        isOpen={isInvoiceOpen}
        onClose={() => setIsInvoiceOpen(false)}
      />
    </div>
  )
}
