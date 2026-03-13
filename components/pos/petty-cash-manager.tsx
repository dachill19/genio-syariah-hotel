'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatRupiah, cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { PiggyBank, RefreshCw, Wallet, Landmark, ReceiptText, ImagePlus, TrendingUp, Eye } from 'lucide-react'

interface PettyCashManagerProps {
  unitId: number
}

interface PettyCashEntry {
  id: string
  source_account: '1101' | '1103'
  amount: number
  description: string
  receipt_proof?: string | null
  created_at: string
  sentinel_order_id: string
  journal_entry_id: string
  username: string
  invoice_number: string
}

const SOURCE_ACCOUNT_OPTIONS = [
  { value: '1101', label: '1101 - Kas Tunai', icon: Wallet },
  { value: '1103', label: '1103 - Kas di Bank EDC BCA', icon: Landmark },
] as const

const createIdempotencyKey = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`

export function PettyCashManager({ unitId }: PettyCashManagerProps) {
  const { user } = useAuthStore()
  const [entries, setEntries] = useState<PettyCashEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sourceAccount, setSourceAccount] = useState<'1101' | '1103'>('1101')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [receiptProof, setReceiptProof] = useState<string | null>(null)
  const [previewReceipt, setPreviewReceipt] = useState<{ image: string; title: string } | null>(null)
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => createIdempotencyKey())

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/petty-cash?unitId=${unitId}`)
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to fetch petty cash', error)
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const handleSubmit = async () => {
    if (!user) return

    setSubmitting(true)
    setNotice(null)

    try {
      const res = await fetch('/api/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          user_id: user.id,
          source_account: sourceAccount,
          amount: Number(amount),
          description,
          receipt_proof: receiptProof,
          idempotency_key: idempotencyKey,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setNotice({ type: 'error', message: data.error || 'Failed to save petty cash' })
        return
      }

      setNotice({
        type: 'success',
        message: data.duplicate ? 'Previous submit already recorded.' : 'Petty cash recorded successfully.',
      })
      setSourceAccount('1101')
      setAmount('')
      setDescription('')
      setReceiptProof(null)
      setIdempotencyKey(createIdempotencyKey())
      await fetchEntries()
    } catch (error) {
      console.error('Failed to save petty cash', error)
      setNotice({ type: 'error', message: 'Failed to save petty cash' })
    } finally {
      setSubmitting(false)
    }
  }

  const totalToday = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0)

  const todayStr = new Date().toDateString()
  const topToday = entries
    .filter((entry) => new Date(entry.created_at).toDateString() === todayStr)
    .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
    .slice(0, 5)

  const handleReceiptFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const maxSizeBytes = 1024 * 1024 * 1.5
    if (!file.type.startsWith('image/')) {
      setNotice({ type: 'error', message: 'Receipt file must be an image.' })
      return
    }
    if (file.size > maxSizeBytes) {
      setNotice({ type: 'error', message: 'Receipt image max size is 1.5MB.' })
      return
    }

    const reader = new FileReader()
    const dataUrl = await new Promise<string>((resolve, reject) => {
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('Failed to read image'))
      reader.readAsDataURL(file)
    })

    setReceiptProof(dataUrl)
  }

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              <PiggyBank className="text-primary h-6 w-6" />
            </div>
            Petty Cash
          </h1>
        </div>
        <Button variant="outline" className="gap-2 rounded-xl" onClick={fetchEntries} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="border shadow-sm">
          <CardContent className="space-y-5 p-6">
            <div>
              <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
                New Expense
              </p>
              <h2 className="text-foreground mt-1 text-xl font-bold">Record petty cash expense</h2>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Source Account</label>
              <div className="grid gap-2">
                {SOURCE_ACCOUNT_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSourceAccount(option.value)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all',
                        sourceAccount === option.value
                          ? 'border-primary bg-primary/5 ring-primary/20 ring-2'
                          : 'border-border hover:bg-muted/40',
                      )}
                    >
                      <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-lg">
                        <Icon className="text-primary h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {option.value === '1101' ? 'Cash on hand' : 'EDC / bank source'}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Amount</label>
              <Input
                type="number"
                min={500}
                step={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Minimum 500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Example: buy tissue, gas refill, kitchen cleaning supplies"
                className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Receipt Document</label>
              <label className="border-input bg-background hover:bg-muted/30 flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm text-muted-foreground transition-colors">
                <ImagePlus className="h-4 w-4" />
                <span>{receiptProof ? 'Change receipt image' : 'Upload receipt image'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleReceiptFileChange} />
              </label>
              {receiptProof && (
                <div className="relative overflow-hidden rounded-xl border">
                  <img src={receiptProof} alt="Receipt preview" className="max-h-40 w-full object-contain bg-muted/30" />
                  <button
                    type="button"
                    onClick={() => setReceiptProof(null)}
                    className="absolute top-2 right-2 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            {notice && (
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm font-medium',
                  notice.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700',
                )}
              >
                {notice.message}
              </div>
            )}

            <Button className="w-full rounded-xl" onClick={handleSubmit} disabled={submitting || !user}>
              {submitting ? 'Saving...' : 'Submit Petty Cash'}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Total Recorded
                  </p>
                  <ReceiptText className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-3 text-2xl font-bold text-foreground">{formatRupiah(totalToday)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{entries.length} petty cash entries</p>
              </CardContent>
            </Card>
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Today Usage
                  </p>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                {topToday.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">No petty cash expenses recorded today.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {topToday.map((entry, index) => (
                      <div key={entry.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {index + 1}. {entry.description.length > 24 ? `${entry.description.slice(0, 24)}...` : entry.description}
                        </span>
                        <span className="font-semibold text-foreground">{formatRupiah(Number(entry.amount || 0))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border shadow-sm">
            <CardContent className="p-0">
              <div className="flex items-center justify-between border-b px-5 py-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Recent Petty Cash</h3>
                  <p className="text-xs text-muted-foreground">Sentinel orders are excluded from sales reporting.</p>
                </div>
              </div>

              {loading && entries.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : entries.length === 0 ? (
                <div className="px-5 py-16 text-center">
                  <p className="text-base font-semibold text-foreground">No petty cash entries yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Your first operational expense will appear here.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="px-5 py-3 font-semibold tracking-wider">Date & Time</th>
                        <th className="px-5 py-3 font-semibold tracking-wider">Source</th>
                        <th className="px-5 py-3 font-semibold tracking-wider">Description</th>
                        <th className="px-5 py-3 font-semibold tracking-wider">Manager</th>
                        <th className="px-5 py-3 font-semibold tracking-wider">Sentinel Ref</th>
                        <th className="px-5 py-3 text-right font-semibold tracking-wider">Amount</th>
                        <th className="px-5 py-3 text-center font-semibold tracking-wider">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-border divide-y">
                      {entries.slice(0, 10).map((entry) => (
                        <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                          {/* Left: Entry Info */}
                          <td className="text-muted-foreground px-5 py-3 font-mono text-[13px]">
                            {new Date(entry.created_at).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-primary">
                              {entry.source_account}
                            </span>
                          </td>
                          <td className="text-foreground max-w-[360px] px-5 py-3 text-sm">
                            <span className="block truncate" title={entry.description}>
                              {entry.description}
                            </span>
                          </td>
                          <td className="text-muted-foreground px-5 py-3 text-[13px] font-medium">
                            {entry.username}
                          </td>
                          <td className="text-foreground px-5 py-3 font-mono text-xs">
                            {entry.invoice_number}
                          </td>
                          <td className="text-foreground px-5 py-3 text-right font-bold">
                            {formatRupiah(entry.amount)}
                          </td>

                          {/* Right: Actions */}
                          <td className="px-5 py-3 text-center">
                            {entry.receipt_proof ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                onClick={() =>
                                  setPreviewReceipt({
                                    image: entry.receipt_proof || '',
                                    title: `${entry.invoice_number} - ${entry.description}`,
                                  })
                                }
                                title="View Receipt Photo"
                              >
                                <Eye className="text-muted-foreground hover:text-foreground h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={!!previewReceipt} onOpenChange={(open) => !open && setPreviewReceipt(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Receipt Photo</DialogTitle>
            <DialogDescription className="truncate">{previewReceipt?.title || '-'}</DialogDescription>
          </DialogHeader>
          {previewReceipt?.image ? (
            <div className="overflow-hidden rounded-xl border bg-muted/20">
              <img
                src={previewReceipt.image}
                alt="Petty cash receipt"
                className="max-h-[70vh] w-full object-contain"
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}