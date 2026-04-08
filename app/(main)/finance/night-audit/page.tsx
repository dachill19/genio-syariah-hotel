'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type NightAuditState = {
  business_date: string | null
  last_night_audit_at: string | null
  latest_audit: {
    business_date: string
    total_room_charges: number
    total_folios: number
  } | null
}

type NightAuditResult = {
  success?: boolean
  business_date_closed?: string
  total_room_charges?: number
  total_folios?: number
  error?: string
}

export default function NightAuditPage() {
  const [unitId, setUnitId] = useState('1')
  const [state, setState] = useState<NightAuditState | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NightAuditResult | null>(null)

  const loadState = useCallback(async () => {
    const res = await fetch(`/api/finance/night-audit?unitId=${unitId}`)
    const data = await res.json()
    if (res.ok) {
      setState(data)
    }
  }, [unitId])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadState()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadState])

  const runAudit = async () => {
    setLoading(true)
    const res = await fetch('/api/finance/night-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: Number(unitId) }),
    })

    const data = await res.json()
    setResult(data)
    setLoading(false)
    await loadState()
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Night Audit</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={unitId} onChange={(e) => setUnitId(e.target.value)} className="w-24" />
          <p className="text-sm">Current: {state?.business_date || '-'}</p>
          <p className="text-sm">Last Audit: {state?.last_night_audit_at || '-'}</p>
          <Button onClick={runAudit} disabled={loading}>
            {loading ? 'Running...' : 'Run Night Audit'}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>Success: {String(result.success || false)}</p>
            <p>Business Date Closed: {result.business_date_closed || '-'}</p>
            <p>Total Room Charges: Rp {Number(result.total_room_charges || 0).toLocaleString('id-ID')}</p>
            <p>Total Folios: {Number(result.total_folios || 0)}</p>
            {result.error && <p className="text-red-500">Error: {result.error}</p>}
          </CardContent>
        </Card>
      )}
    </main>
  )
}
