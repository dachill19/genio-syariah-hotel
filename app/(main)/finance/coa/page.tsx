'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type CoaRow = {
  code: string
  account_name: string
  account_type: string
  normal_balance: string
  parent_code: string | null
  level: number
  is_active: boolean
  children_count: number
}

export default function CoaPage() {
  const [rows, setRows] = useState<CoaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    code: '',
    account_name: '',
    account_type: 'Asset',
    normal_balance: 'Debit',
    parent_code: '',
  })

  const grouped = useMemo(() => {
    return rows.reduce<Record<string, CoaRow[]>>((acc, row) => {
      if (!acc[row.account_type]) acc[row.account_type] = []
      acc[row.account_type].push(row)
      return acc
    }, {})
  }, [rows])

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/finance/coa')
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadData])

  const handleCreate = async () => {
    setSaving(true)
    const res = await fetch('/api/finance/coa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        parent_code: form.parent_code || null,
      }),
    })

    if (res.ok) {
      setForm({
        code: '',
        account_name: '',
        account_type: 'Asset',
        normal_balance: 'Debit',
        parent_code: '',
      })
      await loadData()
    }

    setSaving(false)
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Chart of Accounts</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Input
            placeholder="Code"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
          />
          <Input
            placeholder="Account name"
            value={form.account_name}
            onChange={(e) => setForm((p) => ({ ...p, account_name: e.target.value }))}
          />
          <Input
            placeholder="Type"
            value={form.account_type}
            onChange={(e) => setForm((p) => ({ ...p, account_type: e.target.value }))}
          />
          <Input
            placeholder="Normal balance"
            value={form.normal_balance}
            onChange={(e) => setForm((p) => ({ ...p, normal_balance: e.target.value }))}
          />
          <Input
            placeholder="Parent code (optional)"
            value={form.parent_code}
            onChange={(e) => setForm((p) => ({ ...p, parent_code: e.target.value }))}
          />
          <Button disabled={saving} onClick={handleCreate} className="md:col-span-5">
            {saving ? 'Saving...' : 'Create Account'}
          </Button>
        </CardContent>
      </Card>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {Object.entries(grouped).map(([type, list]) => (
            <Card key={type}>
              <CardHeader>
                <CardTitle>{type}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {list.map((row) => (
                    <div key={row.code} className="flex items-center justify-between rounded border p-2">
                      <div>
                        <p className="font-medium">
                          {row.code} - {row.account_name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          Level {row.level} {row.parent_code ? `| Parent ${row.parent_code}` : ''}
                        </p>
                      </div>
                      <p className="text-xs">{row.normal_balance}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  )
}
