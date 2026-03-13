'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Clock,
  ChefHat,
  CheckCircle2,
  XCircle,
  User,
  RefreshCw,
  Utensils,
  Package,
  Printer,
  Flame,
  Bell,
  UtensilsCrossed,
  Hash,
  Coffee,
} from 'lucide-react'
import { KitchenTicketModal } from '@/components/pos/kitchen-ticket-modal'

interface OrderDashboardProps {
  unitId: number
}

type KitchenFilter = 'ALL' | 'NEW' | 'PREPARING' | 'READY'

const KITCHEN_CONFIG: Record<
  string,
  {
    label: string
    color: string
    bg: string
    border: string
    headerGradient: string
    icon: any
    dotColor: string
    next?: string
    nextLabel?: string
    nextIcon?: any
    nextBtnClass?: string
  }
> = {
  NEW: {
    label: 'New Order',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    headerGradient: 'from-blue-50 to-blue-100/50',
    icon: Bell,
    dotColor: 'bg-blue-500',
    next: 'PREPARING',
    nextLabel: 'Start Preparing',
    nextIcon: ChefHat,
    nextBtnClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
  },
  PREPARING: {
    label: 'Preparing',
    color: 'text-orange-700',
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    headerGradient: 'from-orange-50 to-amber-50/50',
    icon: Flame,
    dotColor: 'bg-orange-500',
    next: 'READY',
    nextLabel: 'Mark Ready',
    nextIcon: Package,
    nextBtnClass: 'bg-orange-500 hover:bg-orange-600 shadow-orange-200',
  },
  READY: {
    label: 'Ready to Serve',
    color: 'text-emerald-700',
    bg: 'bg-emerald-100',
    border: 'border-emerald-300',
    headerGradient: 'from-emerald-50 to-green-50/50',
    icon: CheckCircle2,
    dotColor: 'bg-emerald-500',
    next: 'COMPLETED',
    nextLabel: 'Complete Order',
    nextIcon: CheckCircle2,
    nextBtnClass: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200',
  },
  COMPLETED: {
    label: 'Completed',
    color: 'text-green-800',
    bg: 'bg-green-100',
    border: 'border-green-200',
    headerGradient: 'from-green-50 to-green-100/50',
    icon: CheckCircle2,
    dotColor: 'bg-green-500',
  },
  CANCELED: {
    label: 'Canceled',
    color: 'text-red-700',
    bg: 'bg-red-100',
    border: 'border-red-200',
    headerGradient: 'from-red-50 to-red-100/50',
    icon: XCircle,
    dotColor: 'bg-red-500',
  },
}

const FILTER_TABS: { key: KitchenFilter; label: string; icon: any; activeClass: string }[] = [
  {
    key: 'ALL',
    label: 'All Active',
    icon: 'DYNAMIC_ALL', // Will be resolved dynamically in the component
    activeClass: 'bg-primary/10 text-primary border-primary/30',
  },
  { key: 'NEW', label: 'New', icon: Bell, activeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  {
    key: 'PREPARING',
    label: 'Preparing',
    icon: Flame,
    activeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  {
    key: 'READY',
    label: 'Ready',
    icon: Package,
    activeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
]

export function OrderDashboard({ unitId }: OrderDashboardProps) {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<KitchenFilter>('ALL')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [selectedTicketOrder, setSelectedTicketOrder] = useState<any>(null)
  const [isTicketOpen, setIsTicketOpen] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?unitId=${unitId}&activeKitchen=true`)
      const data = await res.json()
      setOrders(data)
    } catch (err) {
      console.error('Failed to fetch orders', err)
    } finally {
      setLoading(false)
    }
  }, [unitId])

  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 10000)
    return () => clearInterval(interval)
  }, [fetchOrders])

  const updateKitchenStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitchen_status: newStatus }),
      })
      if (res.ok) {
        if (newStatus === 'COMPLETED' || newStatus === 'CANCELED') {
          setOrders((prev) => prev.filter((o) => o.id !== orderId))
        } else {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, kitchen_status: newStatus } : o)),
          )
        }
      }
    } catch (err) {
      console.error('Failed to update status', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const filteredOrders =
    filter === 'ALL' ? orders : orders.filter((o) => o.kitchen_status === filter)

  const getStatusCounts = () => {
    const counts: Record<string, number> = {}
    orders.forEach((o) => {
      counts[o.kitchen_status] = (counts[o.kitchen_status] || 0) + 1
    })
    return counts
  }
  const statusCounts = getStatusCounts()

  const getTimeSince = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    return `${hours}h ${mins % 60}m ago`
  }

  const handlePrintTicket = (order: any) => {
    setSelectedTicketOrder(order)
    setIsTicketOpen(true)
  }

  const STEP_LABELS = ['New', 'Preparing', 'Ready']
  const getStepIndex = (status: string) => {
    if (status === 'NEW') return 0
    if (status === 'PREPARING') return 1
    if (status === 'READY') return 2
    return -1
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              {unitId === 1 ? (
                <Coffee className="text-primary h-6 w-6" />
              ) : (
                <ChefHat className="text-primary h-6 w-6" />
              )}
            </div>
            Active Orders
          </h1>
          <p className="text-muted-foreground mt-1.5 ml-14 text-sm">
            {orders.length > 0 ? (
              <>
                <span className="text-foreground font-semibold">{orders.length}</span> active{' '}
                {orders.length === 1 ? 'order' : 'orders'} in queue
              </>
            ) : (
              'No active orders right now'
            )}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2 rounded-xl"
          onClick={fetchOrders}
          disabled={loading}
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-2">
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'ALL' ? orders.length : statusCounts[tab.key] || 0
          const TabIcon = tab.icon === 'DYNAMIC_ALL' ? (unitId === 1 ? Coffee : Utensils) : tab.icon
          const isActive = filter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? `${tab.activeClass} shadow-sm`
                  : 'bg-card text-muted-foreground hover:bg-muted border-transparent shadow-sm',
              )}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
              {count > 0 && (
                <span
                  className={cn(
                    'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold',
                    isActive ? 'bg-current/20 text-inherit' : 'bg-muted text-muted-foreground',
                  )}
                  style={isActive ? { backgroundColor: 'rgba(0,0,0,0.08)' } : undefined}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders Grid */}
      <div className="custom-scrollbar flex-1 overflow-y-auto pb-8">
        {loading && orders.length === 0 ? (
          <div className="text-muted-foreground flex h-64 flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin opacity-30" />
            <p className="text-sm font-medium">Loading orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="bg-muted/50 flex h-20 w-20 items-center justify-center rounded-2xl">
              {unitId === 1 ? (
                <Coffee className="text-muted-foreground h-10 w-10" />
              ) : (
                <UtensilsCrossed className="text-muted-foreground h-10 w-10" />
              )}
            </div>
            <div className="text-center">
              <p className="text-foreground text-lg font-semibold">All caught up!</p>
              <p className="text-muted-foreground mt-1 text-sm">
                {filter !== 'ALL'
                  ? `No ${filter.toLowerCase()} orders at the moment`
                  : 'No active orders in the kitchen queue'}
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredOrders.map((order, index) => {
              const config = KITCHEN_CONFIG[order.kitchen_status] || KITCHEN_CONFIG.NEW
              const StatusIcon = config.icon
              const items = Array.isArray(order.items) ? order.items : []
              const totalQty = items.reduce((sum: number, i: any) => sum + (i.qty || 0), 0)
              const isUpdating = updatingId === order.id
              const stepIndex = getStepIndex(order.kitchen_status)

              return (
                <Card
                  key={order.id}
                  className={cn(
                    'animate-slide-in-card relative flex flex-col overflow-hidden rounded-2xl border-2 shadow-sm transition-all duration-300 hover:shadow-md',
                    config.border,
                  )}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {/* Gradient Header */}
                  <div className={cn('bg-linear-to-r p-4 pb-3', config.headerGradient)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'relative flex h-10 w-10 items-center justify-center rounded-xl shadow-sm',
                            config.bg,
                          )}
                        >
                          <StatusIcon className={cn('h-5 w-5', config.color)} />
                          {order.kitchen_status === 'NEW' && (
                            <span
                              className={cn(
                                'animate-pulse-dot absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full',
                                config.dotColor,
                              )}
                            />
                          )}
                        </div>
                        <div>
                          <div className="text-foreground flex items-center gap-1.5 text-base font-bold">
                            Table {order.table_number || '-'}
                          </div>
                          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <User className="h-3 w-3" />
                            {order.customer_name || 'Guest'}
                            <span className="mx-0.5 opacity-40">•</span>
                            <Clock className="h-3 w-3" />
                            {getTimeSince(order.created_at)}
                          </div>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'rounded-lg px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase shadow-sm',
                          config.bg,
                          config.color,
                        )}
                      >
                        {config.label}
                      </span>
                    </div>

                    {/* Progress Steps */}
                    <div className="mt-3 flex items-center gap-1">
                      {STEP_LABELS.map((step, i) => (
                        <div key={step} className="flex flex-1 items-center gap-1">
                          <div
                            className={cn(
                              'h-1.5 flex-1 rounded-full transition-all duration-300',
                              i <= stepIndex ? config.dotColor : 'bg-black/10',
                            )}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="mt-1 flex justify-between text-[9px] font-medium tracking-wider uppercase opacity-40">
                      {STEP_LABELS.map((step) => (
                        <span key={step}>{step}</span>
                      ))}
                    </div>
                  </div>

                  {/* Order Type + Table Badge */}
                  <div className="flex gap-2 border-b px-4 py-2.5">
                    <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium">
                      <Hash className="h-3 w-3" />
                      {order.order_type || 'Dine in'}
                    </span>
                    <span className="text-muted-foreground ml-auto text-[11px]">
                      {order.invoice_number}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="flex-1 px-4 py-3">
                    <div className="text-muted-foreground mb-2.5 flex items-center justify-between text-[10px] font-bold tracking-widest uppercase">
                      <span>Order Items</span>
                      <span className="bg-muted rounded-md px-1.5 py-0.5">
                        {totalQty} {totalQty === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item: any, idx: number) => {
                        const variants = item.selectedVariants
                          ? Object.values(item.selectedVariants)
                              .map((v: any) => v.name)
                              .filter(Boolean)
                          : []
                        return (
                          <div
                            key={idx}
                            className={cn(
                              'flex gap-2.5',
                              variants.length > 0 ? 'items-start' : 'items-center',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-6 min-w-6 items-center justify-center rounded-md text-[11px] font-bold text-white shadow-sm',
                                config.dotColor,
                              )}
                            >
                              {item.qty}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-foreground text-sm leading-snug font-semibold">
                                {item.name}
                              </p>
                              {variants.length > 0 && (
                                <p className="text-muted-foreground mt-0.5 truncate text-[11px] italic">
                                  {variants.join(' · ')}
                                </p>
                              )}
                              {item.note && (
                                <p className="mt-0.5 truncate text-[11px] text-amber-600 italic">
                                  Note: {item.note}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="bg-muted/50 mt-auto flex items-center gap-2 border-t px-4 py-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-card h-9 gap-1.5 rounded-xl border text-xs shadow-sm hover:shadow"
                      onClick={() => handlePrintTicket(order)}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print Ticket
                    </Button>

                    <div className="flex-1" />

                    {unitId !== 1 &&
                      order.kitchen_status !== 'COMPLETED' &&
                      order.kitchen_status !== 'CANCELED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 shrink-0 rounded-xl p-0 text-red-400 hover:bg-red-50 hover:text-red-600"
                          disabled={isUpdating}
                          onClick={() => updateKitchenStatus(order.id, 'CANCELED')}
                          title="Cancel Order"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}

                    {config.next && (
                      <Button
                        size="sm"
                        className={cn(
                          'h-9 gap-1.5 rounded-xl text-xs font-semibold text-white shadow-md',
                          config.nextBtnClass,
                        )}
                        disabled={isUpdating}
                        onClick={() => updateKitchenStatus(order.id, config.next!)}
                      >
                        {isUpdating ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            {config.nextIcon && <config.nextIcon className="h-3.5 w-3.5" />}
                            {config.nextLabel}
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <KitchenTicketModal
        order={selectedTicketOrder}
        isOpen={isTicketOpen}
        onClose={() => setIsTicketOpen(false)}
      />
    </div>
  )
}
