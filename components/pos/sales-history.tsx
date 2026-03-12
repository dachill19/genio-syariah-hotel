'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatRupiah, cn } from '@/lib/utils'
import {
  Calendar,
  History,
  Receipt,
  Search,
  Eye,
  FilterX,
  Banknote,
  QrCode,
  CreditCard,
  UtensilsCrossed,
  ShoppingBag,
  Package,
} from 'lucide-react'
import { ReceiptViewDialog } from '@/components/pos/receipt-view-dialog'

interface SalesHistoryProps {
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

export function SalesHistory({ unitId }: SalesHistoryProps) {
  // Date Filters
  const [preset, setPreset] = useState<DatePreset>('today')
  const [startDate, setStartDate] = useState(() => getPresetDates('today').start)
  const [endDate, setEndDate] = useState(getToday())

  // Advanced Filters
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [cashierFilter, setCashierFilter] = useState('')

  // Data State
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

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

  const resetFilters = () => {
    setPaymentFilter('ALL')
    setTypeFilter('ALL')
    setCashierFilter('')
  }

  const fetchHistory = useCallback(async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        unitId: unitId.toString(),
        paymentMethod: paymentFilter,
        orderType: typeFilter,
        cashierName: cashierFilter,
      })
      const res = await fetch(`/api/history?${params.toString()}`)
      const data = await res.json()
      setTransactions(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch history', err)
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, unitId, paymentFilter, typeFilter, cashierFilter])

  // Refetch when filters change
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchHistory()
    }, 500) // debounce for typing cashier names
    return () => clearTimeout(timer)
  }, [fetchHistory])

  // Summaries
  const totalAmount = transactions.reduce((sum, tx) => sum + Number(tx.grand_total), 0)
  const totalRows = transactions.length

  return (
    <div className="bg-background flex h-screen flex-col overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              <History className="text-primary h-6 w-6" />
            </div>
            Sales History
          </h1>
          <p className="text-muted-foreground mt-1.5 ml-14 text-sm">
            {totalRows} transactions • {formatRupiah(totalAmount)} total
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

      {/* Advanced Filters */}
      <Card className="mb-6 border shadow-sm">
        <CardContent className="p-4 flex flex-wrap items-center gap-4 bg-muted/20">
          
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Cashier Name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search by cashier..."
                value={cashierFilter}
                onChange={(e) => setCashierFilter(e.target.value)}
                className="pl-9 h-10 w-full bg-background"
              />
            </div>
          </div>

          <div className="w-[180px]">
             <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Payment Method</label>
             <select 
               value={paymentFilter}
               onChange={(e) => setPaymentFilter(e.target.value)}
               className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
             >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash</option>
                <option value="QRIS">QRIS</option>
                <option value="CARD">Card</option>
             </select>
          </div>

          <div className="w-[180px]">
             <label className="text-xs font-bold text-muted-foreground uppercase mb-1.5 block">Order Type</label>
             <select 
               value={typeFilter}
               onChange={(e) => setTypeFilter(e.target.value)}
               className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
             >
                <option value="ALL">All Types</option>
                <option value="Dine in">Dine in</option>
                <option value="Take Away">Take Away</option>
             </select>
          </div>

          <div className="flex items-end h-[62px]">
             <Button 
                variant="outline" 
                onClick={resetFilters}
                className="h-10 text-muted-foreground"
             >
                <FilterX className="h-4 w-4 mr-2" />
                Reset
             </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="flex-1 border flex flex-col overflow-hidden shadow-sm">
        <CardContent className="p-0 flex flex-col h-full">
          <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
            <table className="w-full text-left text-sm whitespace-nowrap relative">
              <thead className="bg-muted/80 text-muted-foreground text-xs uppercase sticky top-0 z-10 shadow-sm backdrop-blur-md">
                <tr>
                  <th className="px-5 py-4 font-bold tracking-wider">Date & Time</th>
                  <th className="px-5 py-4 font-bold tracking-wider">Invoice</th>
                  <th className="px-5 py-4 font-bold tracking-wider">Type</th>
                  <th className="px-5 py-4 font-bold tracking-wider">Payment</th>
                  <th className="px-5 py-4 font-bold tracking-wider">Cashier</th>
                  <th className="px-5 py-4 font-bold tracking-wider text-right">Total</th>
                  <th className="px-5 py-4 font-bold tracking-wider text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border relative">
                {loading && transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center text-muted-foreground">
                      <div className="flex items-center justify-center">
                         <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                         <span className="ml-3 font-medium">Loading history...</span>
                      </div>
                    </td>
                  </tr>
                ) : transactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-24 text-center text-muted-foreground">
                       <div className="bg-muted/50 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Receipt className="h-8 w-8 opacity-50" />
                       </div>
                       <p className="text-lg font-semibold text-foreground">No transactions found</p>
                       <p className="text-sm mt-1 mb-2">Try adjusting your filters or date range.</p>
                       {(paymentFilter !== 'ALL' || typeFilter !== 'ALL' || cashierFilter !== '') && (
                         <Button variant="link" onClick={resetFilters} className="text-primary h-auto p-0">
                           Clear active filters
                         </Button>
                       )}
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx: any) => {
                    const PaymentIcon = getPaymentBadgeConfig(tx.payment_method || '').icon
                    const TypeIcon = getOrderTypeBadgeConfig(tx.order_type || '').icon
                    const paymentConfig = getPaymentBadgeConfig(tx.payment_method || '')
                    const typeConfig = getOrderTypeBadgeConfig(tx.order_type || '')

                    return (
                      <tr key={tx.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-5 py-4 font-mono text-[13px] text-muted-foreground">
                          {new Date(tx.created_at).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'medium'
                          })}
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-foreground">
                          {tx.invoice_number}
                        </td>
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4">
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
                        <td className="px-5 py-4 text-[13px] font-medium text-muted-foreground">
                          {tx.cashier_name || 'Guest'}
                        </td>
                        <td className="px-5 py-4 text-right font-black text-foreground">
                          {formatRupiah(tx.grand_total)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTx({
                                ...tx,
                                unit_id: unitId 
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
