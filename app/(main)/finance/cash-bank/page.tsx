'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type BankAccount = {
  id: number
  account_name: string
  account_number: string
  bank_name: string | null
  currency_code: string
  account_type: string
}

type ExchangeRate = {
  id: number
  rate_date: string
  from_currency: string
  to_currency: string
  rate: number
}

export default function CashBankPage() {
  const [unitId, setUnitId] = useState('1')
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [accountForm, setAccountForm] = useState({
    account_name: '',
    account_number: '',
    bank_name: '',
    currency_code: 'IDR',
  })
  const [rateForm, setRateForm] = useState({
    rate_date: new Date().toISOString().slice(0, 10),
    from_currency: 'USD',
    to_currency: 'IDR',
    rate: '16000',
  })

  const loadData = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch(`/api/finance/cash-bank/accounts?unitId=${unitId}`),
      fetch('/api/finance/cash-bank/exchange-rates'),
    ])

    const accountData = await a.json()
    const rateData = await r.json()

    setAccounts(Array.isArray(accountData) ? accountData : [])
    setRates(Array.isArray(rateData) ? rateData : [])
  }, [unitId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadData])

  const submitAccount = async () => {
    const res = await fetch('/api/finance/cash-bank/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: Number(unitId), ...accountForm }),
    })
    if (res.ok) {
      setAccountForm({ account_name: '', account_number: '', bank_name: '', currency_code: 'IDR' })
      await loadData()
    }
  }

  const submitRate = async () => {
    const res = await fetch('/api/finance/cash-bank/exchange-rates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rateForm, rate: Number(rateForm.rate) }),
    })
    if (res.ok) {
      await loadData()
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Cash and Bank</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unit Scope</CardTitle>
        </CardHeader>
        <CardContent>
          <Input value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-24" />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bank Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Account name"
              value={accountForm.account_name}
              onChange={(e) => setAccountForm((p) => ({ ...p, account_name: e.target.value }))}
            />
            <Input
              placeholder="Account number"
              value={accountForm.account_number}
              onChange={(e) => setAccountForm((p) => ({ ...p, account_number: e.target.value }))}
            />
            <Input
              placeholder="Bank name"
              value={accountForm.bank_name}
              onChange={(e) => setAccountForm((p) => ({ ...p, bank_name: e.target.value }))}
            />
            <Input
              placeholder="Currency"
              value={accountForm.currency_code}
              onChange={(e) => setAccountForm((p) => ({ ...p, currency_code: e.target.value.toUpperCase() }))}
            />
            <Button onClick={submitAccount}>Create Bank Account</Button>
            <div className="space-y-2 pt-2">
              {accounts.map((acc) => (
                <div key={acc.id} className="rounded border p-2">
                  <p className="font-medium">
                    {acc.account_name} ({acc.currency_code})
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {acc.bank_name || '-'} | {acc.account_number}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Exchange Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="date"
              value={rateForm.rate_date}
              onChange={(e) => setRateForm((p) => ({ ...p, rate_date: e.target.value }))}
            />
            <Input
              placeholder="From currency"
              value={rateForm.from_currency}
              onChange={(e) => setRateForm((p) => ({ ...p, from_currency: e.target.value.toUpperCase() }))}
            />
            <Input
              placeholder="To currency"
              value={rateForm.to_currency}
              onChange={(e) => setRateForm((p) => ({ ...p, to_currency: e.target.value.toUpperCase() }))}
            />
            <Input
              placeholder="Rate"
              value={rateForm.rate}
              onChange={(e) => setRateForm((p) => ({ ...p, rate: e.target.value }))}
            />
            <Button onClick={submitRate}>Save Rate</Button>
            <div className="space-y-2 pt-2">
              {rates.map((rate) => (
                <div key={rate.id} className="rounded border p-2 text-sm">
                  <p>
                    {rate.rate_date} | {rate.from_currency}/{rate.to_currency}
                  </p>
                  <p className="text-muted-foreground">{Number(rate.rate).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
