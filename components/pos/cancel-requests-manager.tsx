'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { formatRupiah } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Receipt,
  Utensils,
  MessageSquare,
  CheckCheck,
  ClipboardX,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CancelRequest {
  id: string
  reason: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
  reviewed_at: string | null
  order_id: string
  invoice_number: string
  table_number: string
  customer_name: string | null
  grand_total: number
  subtotal: number
  tax_amount: number
  requested_by_name: string
  reviewed_by_name: string | null
}

interface CancelRequestsManagerProps {
  unitId: number
}

export function CancelRequestsManager({ unitId }: CancelRequestsManagerProps) {
  const { user } = useAuthStore()
  const [requests, setRequests] = useState<CancelRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'>('PENDING')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    id: string
    action: 'APPROVE' | 'REJECT'
    invoice: string
    table: string
  } | null>(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ unitId: String(unitId) })
      if (filter !== 'ALL') params.append('status', filter)
      const res = await fetch(`/api/cancel-requests?${params}`)
      const data = await res.json()
      setRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch cancel requests', err)
    } finally {
      setLoading(false)
    }
  }, [unitId, filter])

  useEffect(() => {
    fetchRequests()
    const interval = setInterval(fetchRequests, 15000)
    return () => clearInterval(interval)
  }, [fetchRequests])

  const handleAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    if (!user) return
    setActionLoading(id)
    setConfirmDialog(null)
    try {
      const res = await fetch(`/api/cancel-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reviewed_by: user.id }),
      })
      if (res.ok) {
        await fetchRequests()
      } else {
        const err = await res.json()
        alert(err.error || 'Action failed')
      }
    } catch (err) {
      console.error('Action failed', err)
    } finally {
      setActionLoading(null)
    }
  }

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.floor(mins / 60)
    return `${hours}h ${mins % 60}m ago`
  }

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  return (
    <div className="min-h-screen bg-background p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              <ShieldAlert className="text-primary h-6 w-6" />
            </div>
            Cancel Order Requests
          </h1>
          <p className="text-muted-foreground mt-1.5 ml-14 text-sm">
            Review and approve or reject cashier cancellation requests
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={fetchRequests}
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex items-center gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all',
              filter === tab
                ? tab === 'PENDING'
                  ? 'bg-amber-500 text-white shadow-md'
                  : tab === 'APPROVED'
                    ? 'bg-emerald-500 text-white shadow-md'
                    : tab === 'REJECTED'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'bg-primary text-primary-foreground shadow-md'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            {tab === 'PENDING' && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
                {pendingCount}
              </span>
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* Request List */}
      {loading && requests.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <RefreshCw className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <ClipboardX className="text-muted-foreground h-10 w-10" />
          </div>
          <h3 className="text-foreground text-lg font-bold">No requests found</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            {filter === 'PENDING'
              ? 'There are no pending cancellation requests.'
              : `No ${filter.toLowerCase()} requests to display.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <div
              key={req.id}
              className={cn(
                'bg-card rounded-2xl border p-6 shadow-sm transition-all',
                req.status === 'PENDING' && 'border-amber-200 bg-amber-50/30',
                req.status === 'APPROVED' && 'border-emerald-200 bg-emerald-50/20',
                req.status === 'REJECTED' && 'border-red-200 bg-red-50/20',
              )}
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left: Order Info */}
                <div className="flex flex-1 flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-bold',
                        req.status === 'PENDING' && 'bg-amber-100 text-amber-700',
                        req.status === 'APPROVED' && 'bg-emerald-100 text-emerald-700',
                        req.status === 'REJECTED' && 'bg-red-100 text-red-700',
                      )}
                    >
                      {req.status}
                    </span>
                    <span className="text-foreground font-bold">{req.invoice_number}</span>
                    <span className="text-muted-foreground text-sm">·</span>
                    <span className="text-muted-foreground flex items-center gap-1 text-sm">
                      <Utensils className="h-3.5 w-3.5" />
                      Table {req.table_number}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Customer
                      </p>
                      <p className="text-foreground flex items-center gap-1 text-sm font-semibold">
                        <User className="h-3.5 w-3.5" />
                        {req.customer_name || 'Guest'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Total
                      </p>
                      <p className="text-foreground flex items-center gap-1 text-sm font-semibold">
                        <Receipt className="h-3.5 w-3.5" />
                        {formatRupiah(req.grand_total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Requested by
                      </p>
                      <p className="text-foreground text-sm font-semibold">{req.requested_by_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        Time
                      </p>
                      <p className="text-muted-foreground flex items-center gap-1 text-sm">
                        <Clock className="h-3.5 w-3.5" />
                        {getTimeSince(req.created_at)}
                      </p>
                    </div>
                  </div>

                  {req.reason && (
                    <div className="flex items-start gap-2 rounded-xl bg-white/60 px-3 py-2.5 text-sm">
                      <MessageSquare className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                      <p className="text-muted-foreground italic">&ldquo;{req.reason}&rdquo;</p>
                    </div>
                  )}

                  {req.status !== 'PENDING' && req.reviewed_by_name && (
                    <p className="text-muted-foreground text-xs">
                      {req.status === 'APPROVED' ? 'Approved' : 'Rejected'} by{' '}
                      <span className="font-semibold">{req.reviewed_by_name}</span>
                      {req.reviewed_at && <> · {getTimeSince(req.reviewed_at)}</>}
                    </p>
                  )}
                </div>

                {/* Right: Actions */}
                {req.status === 'PENDING' && (
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button
                      className="gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={actionLoading === req.id}
                      onClick={() =>
                        setConfirmDialog({
                          id: req.id,
                          action: 'APPROVE',
                          invoice: req.invoice_number,
                          table: req.table_number,
                        })
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 rounded-xl border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50"
                      disabled={actionLoading === req.id}
                      onClick={() =>
                        setConfirmDialog({
                          id: req.id,
                          action: 'REJECT',
                          invoice: req.invoice_number,
                          table: req.table_number,
                        })
                      }
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {req.status === 'APPROVED' && (
                  <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-100 px-4 text-sm font-semibold text-emerald-700">
                    <CheckCheck className="h-4 w-4" />
                    Approved
                  </div>
                )}

                {req.status === 'REJECTED' && (
                  <div className="flex h-10 shrink-0 items-center gap-2 rounded-xl bg-red-100 px-4 text-sm font-semibold text-red-700">
                    <XCircle className="h-4 w-4" />
                    Rejected
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card w-full max-w-sm rounded-2xl border p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  confirmDialog.action === 'APPROVE' ? 'bg-emerald-100' : 'bg-red-100',
                )}
              >
                {confirmDialog.action === 'APPROVE' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold">
                  {confirmDialog.action === 'APPROVE' ? 'Approve Cancellation?' : 'Reject Request?'}
                </h3>
                <p className="text-muted-foreground text-xs">
                  {confirmDialog.invoice} · Table {confirmDialog.table}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mb-6 text-sm">
              {confirmDialog.action === 'APPROVE'
                ? 'This will permanently cancel the order. The table will become available again.'
                : 'The cashier will be notified that the request was rejected and the order continues.'}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => setConfirmDialog(null)}
                disabled={actionLoading !== null}
              >
                Back
              </Button>
              <Button
                className={cn(
                  'flex-1 rounded-xl text-white',
                  confirmDialog.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700',
                )}
                onClick={() => handleAction(confirmDialog.id, confirmDialog.action)}
                disabled={actionLoading !== null}
              >
                {actionLoading ? 'Processing…' : confirmDialog.action === 'APPROVE' ? 'Yes, Cancel Order' : 'Yes, Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
