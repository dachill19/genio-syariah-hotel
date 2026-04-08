'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type TrialBalanceResponse = {
  rows: Array<{
    code: string
    account_name: string
    total_debit: number
    total_credit: number
    balance: number
  }>
  totals: {
    total_debit: number
    total_credit: number
    is_balanced: boolean
  }
}

export default function GeneralLedgerPage() {
  const [unitId, setUnitId] = useState('1')
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<TrialBalanceResponse | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/finance/general-ledger/trial-balance?unitId=${unitId}&asOfDate=${asOfDate}`)
    const payload = await res.json()
    if (res.ok) {
      setData(payload)
    }
    setLoading(false)
  }, [asOfDate, unitId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadData])

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">General Ledger</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trial Balance</CardTitle>
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
          <Button onClick={loadData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader>
            <CardTitle>
              Totals: Debit {data.totals.total_debit.toLocaleString('id-ID')} | Credit{' '}
              {data.totals.total_credit.toLocaleString('id-ID')} |{' '}
              {data.totals.is_balanced ? 'Balanced' : 'Not Balanced'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.rows.map((row) => (
                <div key={row.code} className="grid grid-cols-12 rounded border p-2 text-sm">
                  <p className="col-span-2">{row.code}</p>
                  <p className="col-span-4">{row.account_name}</p>
                  <p className="col-span-2 text-right">{Number(row.total_debit).toLocaleString('id-ID')}</p>
                  <p className="col-span-2 text-right">{Number(row.total_credit).toLocaleString('id-ID')}</p>
                  <p className="col-span-2 text-right">{Number(row.balance).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
