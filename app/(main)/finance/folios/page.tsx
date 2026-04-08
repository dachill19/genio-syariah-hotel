'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

type Folio = {
  id: string
  reservation_no: string | null
  room_number: string
  guest_name: string
  check_in_date: string
  check_out_date: string
  room_rate: number
  status: string
  total_charges: number
}

type FolioCharge = {
  id: string
  charge_type: string
  amount_base: number
  status: string
}

function getDefaultFolioForm() {
  const today = new Date()
  const nextDay = new Date(today)
  nextDay.setDate(today.getDate() + 1)

  return {
    guest_name: '',
    reservation_no: '',
    room_number: '',
    check_in_date: today.toISOString().slice(0, 10),
    check_out_date: nextDay.toISOString().slice(0, 10),
    room_rate: '500000',
  }
}

function getDefaultChargeForm() {
  return {
    charge_type: 'ROOM_SERVICE',
    amount: '50000',
    description: '',
    charge_date: new Date().toISOString().slice(0, 10),
  }
}

export default function FoliosPage() {
  const [unitId, setUnitId] = useState('1')
  const [folios, setFolios] = useState<Folio[]>([])
  const [selectedFolio, setSelectedFolio] = useState<string>('')
  const [charges, setCharges] = useState<FolioCharge[]>([])
  const [form, setForm] = useState(getDefaultFolioForm)
  const [chargeForm, setChargeForm] = useState(getDefaultChargeForm)

  const loadFolios = useCallback(async () => {
    const res = await fetch(`/api/finance/folios?unitId=${unitId}`)
    const data = await res.json()
    setFolios(Array.isArray(data) ? data : [])
  }, [unitId])

  const loadCharges = useCallback(async (folioId: string) => {
    const res = await fetch(`/api/finance/folios/${folioId}/charges`)
    const data = await res.json()
    setCharges(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadFolios()
    }, 0)

    return () => {
      window.clearTimeout(timer)
    }
  }, [loadFolios])

  const handleSelectFolio = async (folioId: string) => {
    setSelectedFolio(folioId)
    await loadCharges(folioId)
  }

  const createFolio = async () => {
    const res = await fetch('/api/finance/folios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        unit_id: Number(unitId),
        guest_name: form.guest_name,
        reservation_no: form.reservation_no || null,
        room_number: form.room_number,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        room_rate: Number(form.room_rate),
      }),
    })

    if (res.ok) {
      setForm((prev) => ({ ...prev, guest_name: '', reservation_no: '', room_number: '' }))
      await loadFolios()
    }
  }

  const postCharge = async () => {
    if (!selectedFolio) return

    const res = await fetch(`/api/finance/folios/${selectedFolio}/charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        charge_type: chargeForm.charge_type,
        amount: Number(chargeForm.amount),
        description: chargeForm.description || null,
        charge_date: chargeForm.charge_date,
      }),
    })

    if (res.ok) {
      await loadCharges(selectedFolio)
      await loadFolios()
    }
  }

  const voidCharge = async (chargeId: string) => {
    const reason = window.prompt('Reason for void')
    if (!reason) return

    const res = await fetch(`/api/finance/folios/charges/${chargeId}/void`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })

    if (res.ok && selectedFolio) {
      await loadCharges(selectedFolio)
      await loadFolios()
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Guest Folio</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Folio</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input value={unitId} onChange={(e) => setUnitId(e.target.value)} placeholder="Unit ID" />
          <Input
            value={form.guest_name}
            onChange={(e) => setForm((p) => ({ ...p, guest_name: e.target.value }))}
            placeholder="Guest name"
          />
          <Input
            value={form.reservation_no}
            onChange={(e) => setForm((p) => ({ ...p, reservation_no: e.target.value }))}
            placeholder="Reservation no"
          />
          <Input
            value={form.room_number}
            onChange={(e) => setForm((p) => ({ ...p, room_number: e.target.value }))}
            placeholder="Room number"
          />
          <Input
            type="date"
            value={form.check_in_date}
            onChange={(e) => setForm((p) => ({ ...p, check_in_date: e.target.value }))}
          />
          <Input
            type="date"
            value={form.check_out_date}
            onChange={(e) => setForm((p) => ({ ...p, check_out_date: e.target.value }))}
          />
          <Input
            value={form.room_rate}
            onChange={(e) => setForm((p) => ({ ...p, room_rate: e.target.value }))}
            placeholder="Room rate"
          />
          <Button className="md:col-span-3" onClick={createFolio}>
            Create Folio
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Folios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {folios.map((folio) => (
            <button
              key={folio.id}
              onClick={() => void handleSelectFolio(folio.id)}
              className="w-full rounded border p-3 text-left"
            >
              <p className="font-medium">
                {folio.room_number} - {folio.guest_name}
              </p>
              <p className="text-muted-foreground text-xs">
                {folio.check_in_date} to {folio.check_out_date} | Charges Rp{' '}
                {Number(folio.total_charges || 0).toLocaleString('id-ID')}
              </p>
            </button>
          ))}
        </CardContent>
      </Card>

      {selectedFolio && (
        <Card>
          <CardHeader>
            <CardTitle>Post Charge</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                value={chargeForm.charge_type}
                onChange={(e) => setChargeForm((p) => ({ ...p, charge_type: e.target.value.toUpperCase() }))}
                placeholder="Charge type"
              />
              <Input
                value={chargeForm.amount}
                onChange={(e) => setChargeForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="Amount"
              />
              <Input
                type="date"
                value={chargeForm.charge_date}
                onChange={(e) => setChargeForm((p) => ({ ...p, charge_date: e.target.value }))}
              />
              <Input
                value={chargeForm.description}
                onChange={(e) => setChargeForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description"
              />
            </div>
            <Button onClick={postCharge}>Post Charge</Button>

            <div className="space-y-2 pt-2">
              {charges.map((charge) => (
                <div key={charge.id} className="flex items-center justify-between rounded border p-2">
                  <div>
                    <p className="font-medium">
                      {charge.charge_type} - Rp {Number(charge.amount_base).toLocaleString('id-ID')}
                    </p>
                    <p className="text-muted-foreground text-xs">{charge.status}</p>
                  </div>
                  {charge.status === 'ACTIVE' && (
                    <Button variant="destructive" onClick={() => voidCharge(charge.id)}>
                      Void
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  )
}
