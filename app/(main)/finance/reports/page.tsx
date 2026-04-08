'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type AgingRow = {
  city_ledger_account_id: string
  account_name: string
  account_code: string
  current: number
  d1_30: number
  d31_60: number
  d61_90: number
  d90_plus: number
  total_outstanding: number
}

type CreditAlertRow = {
  id: string
  account_name: string
  account_code: string
  credit_limit: number
  outstanding_amount: number
  utilization_percent: number
}

type OverdueRow = {
  id: string
  invoice_number: string
  due_date: string
  outstanding_amount: number
  days_overdue: number
  account_name: string
}

type PaymentRow = {
  id: string
  payment_date: string
  payment_method: string
  amount: number
  account_name: string
  allocation_count: number
}

type PaymentReceipt = {
  receipt_number: string
  payment: {
    id: string
    payment_date: string
    payment_method: string
    amount: number
    reference_no: string | null
    notes: string | null
    created_at: string
  }
  account: {
    id: string
    account_name: string
    account_code: string
  }
  unit: {
    id: number
    name: string
    type: string
  }
  allocations: Array<{
    invoice_id: string
    allocated_amount: number
    invoice_number: string
    invoice_date: string
    due_date: string
  }>
}

export default function FinanceReportsPage() {
  const [unitId, setUnitId] = useState('1')
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [threshold, setThreshold] = useState('75')
  const [loading, setLoading] = useState(false)
  const [agingRows, setAgingRows] = useState<AgingRow[]>([])
  const [creditAlerts, setCreditAlerts] = useState<CreditAlertRow[]>([])
  const [overdueRows, setOverdueRows] = useState<OverdueRow[]>([])
  const [recentPayments, setRecentPayments] = useState<PaymentRow[]>([])
  const [paymentIdForReceipt, setPaymentIdForReceipt] = useState('')
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receipt, setReceipt] = useState<PaymentReceipt | null>(null)
  const [receiptError, setReceiptError] = useState('')

  const loadData = useCallback(async () => {
    const uid = Number(unitId)
    const th = Number(threshold)
    if (!Number.isFinite(uid) || uid <= 0) return

    setLoading(true)

    const [agingRes, creditRes, overdueRes, paymentsRes] = await Promise.all([
      fetch(`/api/finance/ar/aging?unitId=${uid}&asOfDate=${asOfDate}`),
      fetch(`/api/finance/ar/credit-alerts?unitId=${uid}&threshold=${Number.isFinite(th) ? th : 75}`),
      fetch(`/api/finance/ar/overdue?unitId=${uid}&asOfDate=${asOfDate}&page=1&pageSize=50`),
      fetch(`/api/finance/ar/payments?unitId=${uid}&page=1&pageSize=50`),
    ])

    const agingData = await agingRes.json()
    const creditData = await creditRes.json()
    const overdueData = await overdueRes.json()
    const paymentData = await paymentsRes.json()

    setAgingRows(Array.isArray(agingData?.rows) ? agingData.rows : [])
    setCreditAlerts(Array.isArray(creditData?.rows) ? creditData.rows : [])
    setOverdueRows(Array.isArray(overdueData?.rows) ? overdueData.rows : [])
    const paymentRows = Array.isArray(paymentData?.rows) ? paymentData.rows : Array.isArray(paymentData) ? paymentData : []
    setRecentPayments(paymentRows.slice(0, 10))

    setLoading(false)
  }, [unitId, threshold, asOfDate])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadData()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadData])

  const handleExport = (type: 'aging' | 'overdue' | 'payments') => {
    const uid = Number(unitId)
    if (!Number.isFinite(uid) || uid <= 0) return

    if (type === 'aging') {
      window.open(`/api/finance/ar/exports/aging?unitId=${uid}&asOfDate=${asOfDate}`, '_blank')
      return
    }
    if (type === 'overdue') {
      window.open(`/api/finance/ar/exports/overdue?unitId=${uid}&asOfDate=${asOfDate}`, '_blank')
      return
    }

    window.open(`/api/finance/ar/exports/payments?unitId=${uid}&toDate=${asOfDate}`, '_blank')
  }

  const loadReceipt = async () => {
    if (!paymentIdForReceipt.trim()) {
      setReceiptError('Payment ID is required')
      return
    }

    setReceiptLoading(true)
    setReceiptError('')
    setReceipt(null)

    const res = await fetch(`/api/finance/ar/payments/${encodeURIComponent(paymentIdForReceipt.trim())}/receipt`)
    const data = await res.json()

    if (!res.ok) {
      setReceiptError(String(data?.error || 'Failed to load receipt'))
      setReceiptLoading(false)
      return
    }

    setReceipt(data as PaymentReceipt)
    setReceiptLoading(false)
  }

  const summary = useMemo(() => {
    const totalOutstanding = agingRows.reduce((sum, row) => sum + Number(row.total_outstanding || 0), 0)
    const totalOverdue = overdueRows.reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0)
    const totalRecentPayments = recentPayments.reduce((sum, row) => sum + Number(row.amount || 0), 0)

    return {
      totalOutstanding,
      totalOverdue,
      totalRecentPayments,
      creditAlertCount: creditAlerts.length,
      overdueInvoiceCount: overdueRows.length,
    }
  }, [agingRows, overdueRows, recentPayments, creditAlerts])

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Finance Reports</h1>
        <p className="text-muted-foreground text-sm">Accounts Receivable monitoring dashboard</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <p className="mb-1 text-sm">Unit</p>
            <Input value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-24" />
          </div>
          <div>
            <p className="mb-1 text-sm">As Of Date</p>
            <Input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} />
          </div>
          <div>
            <p className="mb-1 text-sm">Credit Alert Threshold (%)</p>
            <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-32" />
          </div>
          <Button onClick={loadData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          <Button variant="outline" onClick={() => handleExport('aging')}>Export Aging CSV</Button>
          <Button variant="outline" onClick={() => handleExport('overdue')}>Export Overdue CSV</Button>
          <Button variant="outline" onClick={() => handleExport('payments')}>Export Payments CSV</Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total AR Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">Rp {summary.totalOutstanding.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total AR Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">Rp {summary.totalOverdue.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Overdue Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{summary.overdueInvoiceCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Credit Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">{summary.creditAlertCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Payments (10)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">Rp {summary.totalRecentPayments.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>AR Aging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {agingRows.map((row) => (
              <div key={row.city_ledger_account_id} className="rounded border p-2 text-sm">
                <p className="font-medium">
                  {row.account_code} - {row.account_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  Current: {Number(row.current).toLocaleString('id-ID')} | 1-30: {Number(row.d1_30).toLocaleString('id-ID')} | 31-60:{' '}
                  {Number(row.d31_60).toLocaleString('id-ID')} | 61-90: {Number(row.d61_90).toLocaleString('id-ID')} | 90+: {Number(row.d90_plus).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
            {!agingRows.length && <p className="text-sm">No AR aging rows.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credit Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {creditAlerts.map((row) => (
              <div key={row.id} className="rounded border p-2 text-sm">
                <p className="font-medium">
                  {row.account_code} - {row.account_name}
                </p>
                <p className="text-muted-foreground text-xs">
                  Outstanding: {Number(row.outstanding_amount).toLocaleString('id-ID')} | Limit: {Number(row.credit_limit).toLocaleString('id-ID')} | Utilization:{' '}
                  {Number(row.utilization_percent).toLocaleString('id-ID')}%
                </p>
              </div>
            ))}
            {!creditAlerts.length && <p className="text-sm">No credit alerts.</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Overdue Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueRows.map((row) => (
              <div key={row.id} className="rounded border p-2 text-sm">
                <p className="font-medium">{row.invoice_number}</p>
                <p className="text-muted-foreground text-xs">
                  {row.account_name} | Due {row.due_date} | Days: {Number(row.days_overdue)} | Outstanding: {Number(row.outstanding_amount).toLocaleString('id-ID')}
                </p>
              </div>
            ))}
            {!overdueRows.length && <p className="text-sm">No overdue invoices.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Payments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentPayments.map((row) => (
              <div key={row.id} className="rounded border p-2 text-sm">
                <p className="font-medium">
                  {row.payment_date} | {row.payment_method}
                </p>
                <p className="text-muted-foreground text-xs">
                  {row.account_name} | Amount: {Number(row.amount).toLocaleString('id-ID')} | Allocations: {Number(row.allocation_count || 0)}
                </p>
              </div>
            ))}
            {!recentPayments.length && <p className="text-sm">No payments yet.</p>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Payment Receipt Viewer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-sm">Payment ID</p>
              <Input
                value={paymentIdForReceipt}
                onChange={(e) => setPaymentIdForReceipt(e.target.value)}
                placeholder="UUID payment"
                className="w-[360px] max-w-full"
              />
            </div>
            <Button onClick={loadReceipt} disabled={receiptLoading}>
              {receiptLoading ? 'Loading...' : 'Load Receipt'}
            </Button>
          </div>

          {receiptError && <p className="text-sm text-red-500">{receiptError}</p>}

          {receipt && (
            <div className="space-y-2 rounded border p-3 text-sm">
              <p className="font-semibold">{receipt.receipt_number}</p>
              <p>
                Date: {receipt.payment.payment_date} | Method: {receipt.payment.payment_method} | Amount: Rp{' '}
                {Number(receipt.payment.amount).toLocaleString('id-ID')}
              </p>
              <p>
                Account: {receipt.account.account_code} - {receipt.account.account_name}
              </p>
              <p>
                Unit: {receipt.unit.name || '-'} ({receipt.unit.type || '-'})
              </p>
              <div className="space-y-1 pt-2">
                {receipt.allocations.map((alloc) => (
                  <div key={`${alloc.invoice_id}-${alloc.invoice_number}`} className="rounded border p-2 text-xs">
                    {alloc.invoice_number} | Invoice: {alloc.invoice_date} | Due: {alloc.due_date} | Allocated: Rp{' '}
                    {Number(alloc.allocated_amount).toLocaleString('id-ID')}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
