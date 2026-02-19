'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatRupiah, cn } from '@/lib/utils'
import { FileText, TrendingUp, CreditCard, Banknote, Download, Printer } from 'lucide-react'
import { Order } from '@/types/pos'
import { InvoiceModal } from '@/components/pos/invoice-modal'

interface ReportPageProps {
  unitId: number
  unitName: string
}

export function ReportDashboard({ unitId, unitName }: ReportPageProps) {
  const [summary, setSummary] = useState<any>(null)
  const [transactions, setTransactions] = useState<Order[]>([])
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false)

  const handlePrint = (order: Order) => {
    setSelectedOrder(order)
    setIsInvoiceOpen(true)
  }

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?date=${date}&unitId=${unitId}`)
      .then((res) => res.json())
      .then((data) => {
        setSummary(data.summary)
        setTransactions(data.transactions)
      })
      .catch((err) => console.error('Failed to fetch reports', err))
      .finally(() => setLoading(false))
  }, [date, unitId])

  const handleExport = () => {
    window.location.href = `/api/reports/export?date=${date}&unitId=${unitId}`
  }

  const totalSales = summary?.total_sales || 0
  const totalTransactions = summary?.total_transactions || 0
  const cashCount = summary?.cash_count || 0
  const qrisCount = summary?.qris_count || 0

  const summaryCards = [
    {
      title: 'Total Sales',
      value: formatRupiah(totalSales),
      icon: TrendingUp,
      color: 'text-primary',
    },
    {
      title: 'Total Transactions',
      value: totalTransactions,
      icon: FileText,
      color: 'text-muted-foreground',
    },
    { title: 'Cash Payments', value: cashCount, icon: Banknote, color: 'text-success' },
    { title: 'QRIS Payments', value: qrisCount, icon: CreditCard, color: 'text-primary' },
  ]

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
          <FileText className="text-primary" size={32} />
          {unitName} Sales Report
        </h1>

        <div className="flex gap-3">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-background text-foreground w-auto"
          />
          <Button onClick={handleExport} className="gap-2" variant="outline">
            <Download size={16} /> Export Excel
          </Button>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-muted-foreground text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={cn('h-4 w-4', card.color)} />
            </CardHeader>
            <CardContent>
              <div className={cn('text-2xl font-bold', card.color)}>{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-card flex flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="bg-muted/50 text-muted-foreground border-b p-4 text-sm font-medium">
          Recent Transactions
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-muted-foreground flex h-full items-center justify-center">
              Loading...
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-card sticky top-0 z-10 shadow-sm">
                <tr className="border-b">
                  <th className="text-muted-foreground p-4 font-semibold">Time</th>
                  <th className="text-muted-foreground p-4 font-semibold">Invoice</th>
                  <th className="text-muted-foreground p-4 font-semibold">Payment</th>
                  <th className="text-muted-foreground p-4 font-semibold">Status</th>
                  <th className="text-muted-foreground p-4 text-right font-semibold">Total</th>
                  <th className="text-muted-foreground p-4 text-center font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="border-border divide-y">
                {transactions.map((order) => (
                  <tr key={order.invoice_number} className="hover:bg-muted/50 transition-colors">
                    <td className="text-muted-foreground p-4">
                      {new Date(order.created_at).toLocaleTimeString()}
                    </td>
                    <td className="text-foreground p-4 font-medium">{order.invoice_number}</td>
                    <td className="p-4">
                      <span
                        className={cn(
                          'rounded-md px-2 py-1 text-xs font-bold',
                          order.payment_method === 'CASH'
                            ? 'bg-success/20 text-success'
                            : 'bg-primary/20 text-primary',
                        )}
                      >
                        {order.payment_method}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="bg-muted text-muted-foreground rounded px-2 py-1 text-xs font-semibold">
                        {order.status || 'COMPLETED'}
                      </span>
                    </td>
                    <td className="text-foreground p-4 text-right font-bold">
                      {formatRupiah(order.grand_total)}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Print Invoice"
                        onClick={() => handlePrint(order)}
                      >
                        <Printer className="text-muted-foreground hover:text-foreground h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {transactions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-muted-foreground p-12 text-center">
                      No transactions found for this date.
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
