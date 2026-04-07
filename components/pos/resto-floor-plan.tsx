'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { cn, formatRupiah } from '@/lib/utils'
import {
  Users,
  Clock,
  UtensilsCrossed,
  RefreshCw,
  ShoppingBag,
  CreditCard,
  X,
  Plus,
  Banknote,
  QrCode,
  Printer,
  CheckCircle2,
  User,
  XCircle,
  AlertTriangle,
  Hourglass,
  LayoutGrid,
  Square,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter } from 'next/navigation'

interface RestoFloorPlanProps {
  unitId: number
  unitName: string
}

type TableStatus = 'AVAILABLE' | 'DINING' | 'BILLED'
type TableSection = 'INDOOR' | 'OUTDOOR'

interface TableConfig {
  id: number
  number: string
  capacity: number
  shape: 'circle' | 'square' | 'rectangle'
  section: TableSection
  position: { x: number; y: number }
  size: 'small' | 'medium' | 'large'
}

interface TableData extends TableConfig {
  status: TableStatus
  order?: any
  duration?: string
}

const TABLE_SECTIONS: { id: TableSection; name: string; color: string }[] = [
  { id: 'INDOOR', name: 'Indoor Dining', color: 'bg-slate-50/90' },
  { id: 'OUTDOOR', name: 'Outdoor Garden', color: 'bg-emerald-50/70' },
]

const TABLES_CONFIG: TableConfig[] = [
  {
    id: 1,
    number: '1',
    capacity: 4,
    shape: 'square',
    section: 'INDOOR',
    position: { x: 20, y: 32 },
    size: 'medium',
  },
  {
    id: 2,
    number: '2',
    capacity: 4,
    shape: 'square',
    section: 'INDOOR',
    position: { x: 32, y: 32 },
    size: 'medium',
  },
  {
    id: 3,
    number: '3',
    capacity: 4,
    shape: 'square',
    section: 'INDOOR',
    position: { x: 44, y: 32 },
    size: 'medium',
  },
  {
    id: 4,
    number: '4',
    capacity: 4,
    shape: 'square',
    section: 'INDOOR',
    position: { x: 56, y: 32 },
    size: 'medium',
  },
  {
    id: 5,
    number: '5',
    capacity: 4,
    shape: 'square',
    section: 'INDOOR',
    position: { x: 68, y: 32 },
    size: 'medium',
  },
  {
    id: 6,
    number: '6',
    capacity: 4,
    shape: 'square',
    section: 'INDOOR',
    position: { x: 80, y: 32 },
    size: 'medium',
  },
  {
    id: 7,
    number: '7',
    capacity: 4,
    shape: 'square',
    section: 'OUTDOOR',
    position: { x: 20, y: 60 },
    size: 'medium',
  },
  {
    id: 8,
    number: '8',
    capacity: 4,
    shape: 'square',
    section: 'OUTDOOR',
    position: { x: 32, y: 60 },
    size: 'medium',
  },
  {
    id: 9,
    number: '9',
    capacity: 4,
    shape: 'square',
    section: 'OUTDOOR',
    position: { x: 44, y: 60 },
    size: 'medium',
  },
  {
    id: 10,
    number: '10',
    capacity: 4,
    shape: 'square',
    section: 'OUTDOOR',
    position: { x: 56, y: 60 },
    size: 'medium',
  },
  {
    id: 11,
    number: '11',
    capacity: 4,
    shape: 'square',
    section: 'OUTDOOR',
    position: { x: 68, y: 60 },
    size: 'medium',
  },
  {
    id: 12,
    number: '12',
    capacity: 4,
    shape: 'square',
    section: 'OUTDOOR',
    position: { x: 80, y: 60 },
    size: 'medium',
  },
]

const STATUS_CONFIG: Record<
  TableStatus,
  {
    label: string
    bg: string
    border: string
    text: string
    dot: string
    glow: string
    gradient: string
  }
> = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-slate-50/90',
    border: 'border-slate-200',
    text: 'text-slate-400',
    dot: 'bg-slate-300',
    glow: 'shadow-slate-200/50',
    gradient: 'from-slate-50 to-slate-100/70',
  },
  DINING: {
    label: 'Dining',
    bg: 'bg-emerald-50/80',
    border: 'border-emerald-300',
    text: 'text-emerald-600',
    dot: 'bg-emerald-500',
    glow: 'shadow-emerald-200/80',
    gradient: 'from-emerald-50 to-emerald-100/60',
  },
  BILLED: {
    label: 'Billed',
    bg: 'bg-blue-50/80',
    border: 'border-blue-300',
    text: 'text-blue-600',
    dot: 'bg-blue-500',
    glow: 'shadow-blue-200/80',
    gradient: 'from-blue-50 to-blue-100/60',
  },
}

const CHAIR_POSITIONS = [
  'left-1/2 -top-2.5 -translate-x-1/2',
  '-right-2.5 top-1/2 -translate-y-1/2',
  'left-1/2 -bottom-2.5 -translate-x-1/2',
  '-left-2.5 top-1/2 -translate-y-1/2',
]

function TableShape({
  shape,
  size,
  className,
  children,
}: {
  shape: 'circle' | 'square' | 'rectangle'
  size: 'small' | 'medium' | 'large'
  className?: string
  children: React.ReactNode
}) {
  const sizeClasses = {
    small: 'w-20 h-20',
    medium: 'h-[92px] w-[92px]',
    large: shape === 'rectangle' ? 'h-[92px] w-[120px]' : 'h-[104px] w-[104px]',
  }

  const shapeClasses = {
    circle: 'rounded-full',
    square: 'rounded-2xl',
    rectangle: 'rounded-2xl',
  }

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center transition-all duration-300',
        sizeClasses[size],
        shapeClasses[shape],
        className,
      )}
    >
      {children}
    </div>
  )
}

function StatusBadge({ status, pulse = false }: { status: TableStatus; pulse?: boolean }) {
  const config = STATUS_CONFIG[status]

  return (
    <div
      className={cn(
        'absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white shadow-sm',
        config.dot,
        pulse && 'animate-pulse',
      )}
    />
  )
}

export function RestoFloorPlan({ unitId, unitName }: RestoFloorPlanProps) {
  const { user } = useAuthStore()
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedTable, setSelectedTable] = useState<TableData | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<TableSection | 'ALL'>('ALL')
  const [checkoutMode, setCheckoutMode] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelRequests, setCancelRequests] = useState<any[]>([])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/orders?unitId=${unitId}&paymentStatus=UNPAID`)
      const data = await res.json()
      setOrders(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch orders', err)
    } finally {
      setLoading(false)
    }
  }, [unitId])

  const fetchCancelRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/cancel-requests?unitId=${unitId}&status=PENDING`)
      const data = await res.json()
      setCancelRequests(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch cancel requests', err)
    }
  }, [unitId])

  useEffect(() => {
    fetchOrders()
    fetchCancelRequests()
    const interval = setInterval(() => {
      fetchOrders()
      fetchCancelRequests()
    }, 15000)
    return () => clearInterval(interval)
  }, [fetchOrders, fetchCancelRequests])

  const getTableData = useCallback((): TableData[] => {
    return TABLES_CONFIG.map((table) => {
      const order = orders.find(
        (o) => String(o.table_number) === table.number && o.payment_status === 'UNPAID',
      )
      let status: TableStatus = 'AVAILABLE'
      let duration: string | undefined

      if (order) {
        status = 'DINING'
        const diff = Date.now() - new Date(order.created_at).getTime()
        const mins = Math.floor(diff / 60000)
        if (mins < 60) duration = `${mins}m`
        else duration = `${Math.floor(mins / 60)}h ${mins % 60}m`
      }

      return { ...table, status, order, duration }
    })
  }, [orders])

  const tableData = getTableData()

  const filteredTables = useMemo(() => {
    if (activeSection === 'ALL') return tableData
    return tableData.filter((t) => t.section === activeSection)
  }, [tableData, activeSection])

  const counts = useMemo(
    () => ({
      available: tableData.filter((t) => t.status === 'AVAILABLE').length,
      dining: tableData.filter((t) => t.status === 'DINING').length,
      billed: tableData.filter((t) => t.status === 'BILLED').length,
    }),
    [tableData],
  )

  const handleTableClick = (table: TableData) => {
    setSelectedTable(table)
    setSidebarOpen(true)
    setCheckoutMode(false)
  }

  const handleCloseSidebar = () => {
    setSidebarOpen(false)
    setCheckoutMode(false)
    setTimeout(() => setSelectedTable(null), 300)
  }

  const handleOpenTable = () => {
    if (!selectedTable) return
    router.push(`/pos/restaurant/order?table=${selectedTable.number}`)
  }

  const handleAddItems = () => {
    if (!selectedTable?.order) return
    router.push(
      `/pos/restaurant/order?table=${selectedTable.number}&orderId=${selectedTable.order.id}`,
    )
  }

  const handlePrintBill = () => {
    if (!selectedTable?.order) return
    const order = selectedTable.order
    const items = Array.isArray(order.items) ? order.items : []

    const billHtml = `
      <html>
      <head>
        <title>Bill - Table ${order.table_number}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 12px; font-size: 13px; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .header h2 { margin: 0 0 4px; font-size: 16px; }
          .info { font-size: 11px; margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
          .info p { margin: 2px 0; }
          .items { margin-bottom: 8px; border-bottom: 1px dashed #000; padding-bottom: 8px; }
          .item { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 12px; }
          .total-section { margin-top: 8px; }
          .total-row { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; }
          .grand-total { font-size: 16px; font-weight: bold; border-top: 2px dashed #000; padding-top: 8px; margin-top: 8px; }
          .footer { text-align: center; margin-top: 12px; font-size: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>${unitName}</h2>
          <p style="font-size:11px">--- BILL ---</p>
          <p style="font-size:10px">${new Date().toLocaleString('id-ID')}</p>
        </div>
        <div class="info">
          <p>Table: ${order.table_number}</p>
          <p>Customer: ${order.customer_name || '-'}</p>
          <p>Invoice: ${order.invoice_number}</p>
        </div>
        <div class="items">
          ${items
            .map(
              (item: any) => `
            <div class="item">
              <span>${item.qty}x ${item.name}</span>
              <span>Rp ${((item.totalPrice || item.price) * item.qty).toLocaleString('id-ID')}</span>
            </div>
          `,
            )
            .join('')}
        </div>
        <div class="total-section">
          <div class="total-row"><span>Subtotal</span><span>Rp ${Number(order.subtotal).toLocaleString('id-ID')}</span></div>
          <div class="total-row"><span>Tax</span><span>Rp ${Number(order.tax_amount).toLocaleString('id-ID')}</span></div>
          <div class="grand-total">
            <div class="total-row"><span>TOTAL</span><span>Rp ${Number(order.grand_total).toLocaleString('id-ID')}</span></div>
          </div>
        </div>
        <div class="footer">
          <p>Please pay at the cashier</p>
          <p>Thank you!</p>
        </div>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank', 'width=320,height=600')
    if (printWindow) {
      printWindow.document.write(billHtml)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const hasPendingCancelRequest = (orderId: string) => {
    return cancelRequests.some((cr) => cr.order_id === orderId)
  }

  const handleRequestCancel = async () => {
    if (!selectedTable?.order || !user) return
    setCancelLoading(true)
    try {
      const res = await fetch('/api/cancel-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: selectedTable.order.id,
          unit_id: unitId,
          requested_by: user.id,
          reason: cancelReason.trim() || null,
        }),
      })
      if (res.ok) {
        await fetchCancelRequests()
        setCancelModalOpen(false)
        setCancelReason('')
      } else {
        const err = await res.json()
        alert(err.error || 'Failed to submit cancel request')
      }
    } catch (err) {
      console.error('Cancel request failed', err)
    } finally {
      setCancelLoading(false)
    }
  }

  const handleCheckout = async (paymentMethod: string) => {
    if (!selectedTable?.order) return
    setProcessingPayment(true)
    try {
      const res = await fetch(`/api/orders/${selectedTable.order.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_status: 'PAID',
          payment_method: paymentMethod,
        }),
      })
      if (res.ok) {
        await fetchOrders()
        handleCloseSidebar()
      }
    } catch (err) {
      console.error('Payment failed', err)
    } finally {
      setProcessingPayment(false)
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

  const renderTable = (table: TableData) => {
    const config = STATUS_CONFIG[table.status]
    const isSelected = selectedTable?.id === table.id && sidebarOpen
    const items = table.order?.items
      ? Array.isArray(table.order.items)
        ? table.order.items
        : []
      : []
    const totalQty = items.reduce((sum: number, i: any) => sum + (i.qty || 0), 0)

    return (
      <button
        key={table.id}
        onClick={() => handleTableClick(table)}
        className="absolute -translate-x-1/2 -translate-y-1/2 transform transition-all duration-300 hover:z-10 hover:scale-105"
        style={{
          left: `${table.position.x}%`,
          top: `${table.position.y}%`,
        }}
      >
        <div className="relative">
          {CHAIR_POSITIONS.map((position, idx) => (
            <span
              key={`${table.id}-chair-${idx}`}
              className={cn(
                'absolute h-3 w-3 rounded-full border',
                position,
                table.status === 'AVAILABLE'
                  ? 'border-slate-300/70 bg-slate-100/80'
                  : 'border-slate-300/80 bg-white',
              )}
            />
          ))}
          <TableShape
            shape={table.shape}
            size={table.size}
            className={cn(
              'border-2 bg-gradient-to-br shadow-md transition-all duration-300 hover:z-10 hover:scale-[1.02] hover:shadow-lg',
              config.gradient,
              config.border,
              config.glow,
              isSelected && 'ring-primary/40 ring-2 ring-offset-1',
            )}
          >
            <StatusBadge status={table.status} pulse={table.status === 'DINING'} />
            <span
              className={cn(
                'text-2xl font-black tracking-tight',
                table.status === 'AVAILABLE' ? 'text-slate-400' : config.text,
              )}
            >
              {table.number}
            </span>
            <div
              className={cn(
                'mt-1 flex items-center gap-1 text-[10px] font-medium',
                table.status === 'AVAILABLE' ? 'text-slate-400' : 'text-muted-foreground',
              )}
            >
              <Users className="h-3 w-3" />
              {table.capacity}
            </div>
            {table.status !== 'AVAILABLE' && table.order && (
              <div className="mt-1 flex flex-col items-center gap-0.5">
                <span className={cn('max-w-[60px] truncate text-[9px] font-semibold', config.text)}>
                  {table.order.customer_name || 'Guest'}
                </span>
                <span className="text-muted-foreground flex items-center gap-0.5 text-[9px]">
                  <Clock className="h-2.5 w-2.5" />
                  {table.duration}
                </span>
              </div>
            )}
            {totalQty > 0 && (
              <div className="absolute -right-2 -bottom-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-md">
                {totalQty}
              </div>
            )}
          </TableShape>
        </div>
      </button>
    )
  }

  const renderSection = (section: (typeof TABLE_SECTIONS)[0]) => {
    const sectionTables = tableData.filter((t) => t.section === section.id)
    if (sectionTables.length === 0) return null

    return (
      <div
        key={section.id}
        className={cn('absolute rounded-3xl border-2 border-dashed border-slate-200 p-4', section.color)}
        style={{
          left: `${Math.min(...sectionTables.map((t) => t.position.x)) - 8}%`,
          top: `${Math.min(...sectionTables.map((t) => t.position.y)) - 8}%`,
          width: `${Math.max(...sectionTables.map((t) => t.position.x)) - Math.min(...sectionTables.map((t) => t.position.x)) + 20}%`,
          height: `${Math.max(...sectionTables.map((t) => t.position.y)) - Math.min(...sectionTables.map((t) => t.position.y)) + 20}%`,
        }}
      >
        <span className="absolute -top-3 left-4 bg-white px-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
          {section.name}
        </span>
      </div>
    )
  }

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-50">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 flex h-12 w-12 items-center justify-center rounded-xl">
              <LayoutGrid className="text-primary h-6 w-6" />
            </div>
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold">
                {unitName}
                <span className="text-muted-foreground text-sm font-normal">Floor Plan</span>
              </h1>
              <p className="text-muted-foreground text-sm">Select a table to manage orders</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                onClick={() => setActiveSection('ALL')}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  activeSection === 'ALL'
                    ? 'text-foreground bg-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                All
              </button>
              {TABLE_SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                    activeSection === sec.id
                      ? 'text-foreground bg-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {sec.name}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-4 rounded-xl border bg-white px-4 py-2 shadow-sm">
              {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={cn('h-2.5 w-2.5 rounded-full', config.dot)} />
                  <span className="text-muted-foreground text-xs font-medium">
                    {config.label}
                    <span className="text-muted-foreground/60 ml-1">
                      (
                      {key === 'AVAILABLE'
                        ? counts.available
                        : key === 'DINING'
                          ? counts.dining
                          : counts.billed}
                      )
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="rounded-xl"
              onClick={fetchOrders}
              disabled={loading}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden bg-[#f8fafc]">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'linear-gradient(to right, #94a3b8 1px, transparent 1px), linear-gradient(to bottom, #94a3b8 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {TABLE_SECTIONS.map(renderSection)}
          {(activeSection === 'ALL' ? tableData : filteredTables).map(renderTable)}

          <div className="absolute bottom-4 left-4 rounded-xl border bg-white/80 p-3 shadow-lg backdrop-blur-sm">
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <Square className="h-3 w-3" /> 4 seats
              </div>
            </div>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={handleCloseSidebar}
        />
      )}

      <div
        className={cn(
          'fixed top-0 right-0 z-50 flex h-full w-[420px] flex-col border-l bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {selectedTable && (
          <>
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl text-lg font-black',
                    selectedTable.status === 'AVAILABLE'
                      ? 'bg-slate-100 text-slate-400'
                      : selectedTable.status === 'DINING'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-blue-100 text-blue-600',
                  )}
                >
                  {selectedTable.number}
                </div>
                <div>
                  <h2 className="text-foreground text-lg font-bold">Table {selectedTable.number}</h2>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-block h-2 w-2 rounded-full',
                        STATUS_CONFIG[selectedTable.status].dot,
                      )}
                    />
                    <span className="text-muted-foreground text-xs font-medium">
                      {STATUS_CONFIG[selectedTable.status].label}
                      {selectedTable.status !== 'AVAILABLE' && selectedTable.order && (
                        <> · {selectedTable.order.customer_name || 'Guest'}</>
                      )}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg"
                onClick={handleCloseSidebar}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="custom-scrollbar flex-1 overflow-y-auto">
              {selectedTable.status === 'AVAILABLE' ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
                  <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-50">
                    <UtensilsCrossed className="h-12 w-12 text-slate-300" />
                  </div>
                  <h3 className="text-foreground mb-1 text-lg font-bold">Table Available</h3>
                  <p className="text-muted-foreground mb-8 text-center text-sm">
                    This table is empty and ready for new guests.
                    <br />
                    <span className="text-xs">{selectedTable.capacity} seats capacity</span>
                  </p>
                  <Button
                    size="lg"
                    className="bg-primary hover:bg-primary/90 w-full gap-2 rounded-xl py-6 text-base font-bold shadow-md"
                    onClick={handleOpenTable}
                  >
                    <ShoppingBag className="h-5 w-5" />
                    Open Table & Order
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col">
                  <div className="border-b bg-linear-to-r from-orange-50/50 to-amber-50/30 px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="text-muted-foreground h-4 w-4" />
                        <span className="text-foreground text-sm font-semibold">
                          {selectedTable.order?.customer_name || 'Guest'}
                        </span>
                      </div>
                      <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Clock className="h-3.5 w-3.5" />
                        {selectedTable.order?.created_at &&
                          getTimeSince(selectedTable.order.created_at)}
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {selectedTable.order?.invoice_number} ·{' '}
                      {selectedTable.order?.order_type || 'Dine in'}
                    </p>
                  </div>

                  <div className="px-6 py-4">
                    <h4 className="text-muted-foreground mb-3 text-[10px] font-bold tracking-widest uppercase">
                      Order Items
                    </h4>
                    <div className="space-y-3">
                      {(Array.isArray(selectedTable.order?.items)
                        ? selectedTable.order.items
                        : []
                      ).map((item: any, idx: number) => {
                        const variants = item.selectedVariants
                          ? Object.values(item.selectedVariants)
                              .map((v: any) => v.name)
                              .filter(Boolean)
                          : []
                        return (
                          <div key={idx} className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-md bg-orange-100 text-[11px] font-bold text-orange-600">
                                {item.qty}
                              </span>
                              <div>
                                <p className="text-foreground text-sm leading-snug font-semibold">
                                  {item.name}
                                </p>
                                {variants.length > 0 && (
                                  <p className="text-muted-foreground mt-0.5 text-[11px] italic">
                                    {variants.join(' · ')}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="text-foreground shrink-0 text-sm font-semibold tabular-nums">
                              {formatRupiah((item.totalPrice || item.price) * item.qty)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="mx-6 border-t pt-4 pb-4">
                    <div className="text-muted-foreground flex justify-between text-sm">
                      <span>Subtotal</span>
                      <span className="tabular-nums">
                        {formatRupiah(selectedTable.order?.subtotal || 0)}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex justify-between text-sm">
                      <span>Tax</span>
                      <span className="tabular-nums">
                        {formatRupiah(selectedTable.order?.tax_amount || 0)}
                      </span>
                    </div>
                    <div className="text-foreground mt-3 flex justify-between border-t pt-3 text-lg font-bold">
                      <span>Total</span>
                      <span className="tabular-nums">
                        {formatRupiah(selectedTable.order?.grand_total || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedTable.status !== 'AVAILABLE' && selectedTable.order && (
              <div className="bg-muted/50 border-t px-6 py-4">
                {checkoutMode ? (
                  <div>
                    <h4 className="text-foreground mb-3 text-sm font-bold">
                      Select Payment Method
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          method: 'CASH',
                          icon: Banknote,
                          label: 'Cash',
                          color:
                            'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
                        },
                        {
                          method: 'QRIS',
                          icon: QrCode,
                          label: 'QRIS',
                          color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
                        },
                        {
                          method: 'CARD',
                          icon: CreditCard,
                          label: 'Card',
                          color:
                            'bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100',
                        },
                      ].map(({ method, icon: Icon, label, color }) => (
                        <button
                          key={method}
                          onClick={() => handleCheckout(method)}
                          disabled={processingPayment}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-all',
                            color,
                            processingPayment && 'pointer-events-none opacity-50',
                          )}
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      className="mt-2 w-full text-xs"
                      onClick={() => setCheckoutMode(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-10 gap-1.5 rounded-xl text-xs"
                        onClick={handleAddItems}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Items
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 gap-1.5 rounded-xl text-xs"
                        onClick={handlePrintBill}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print Bill
                      </Button>
                    </div>
                    <Button
                      className="bg-primary hover:bg-primary/90 h-12 gap-2 rounded-xl text-sm font-bold shadow-md"
                      onClick={() => setCheckoutMode(true)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Checkout / Payment
                    </Button>
                    {selectedTable.order && hasPendingCancelRequest(selectedTable.order.id) ? (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700">
                        <Hourglass className="h-3.5 w-3.5 animate-pulse" />
                        Cancel pending - awaiting manager approval
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="h-10 gap-1.5 rounded-xl border-red-200 text-xs text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setCancelModalOpen(true)}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        Request Cancel Order
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {cancelModalOpen && selectedTable?.order && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl border p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold">Request Order Cancellation</h3>
                <p className="text-muted-foreground text-xs">
                  Table {selectedTable.number} · {selectedTable.order.invoice_number}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground mb-4 text-sm">
              This request will be sent to the restaurant manager for approval. The order will
              only be cancelled after the manager approves.
            </p>
            <div className="mb-4">
              <label className="text-foreground mb-1.5 block text-sm font-semibold">
                Reason for cancellation
              </label>
              <textarea
                className="border-input bg-background text-foreground placeholder:text-muted-foreground w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-300"
                rows={3}
                placeholder="Enter reason (optional)..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => {
                  setCancelModalOpen(false)
                  setCancelReason('')
                }}
                disabled={cancelLoading}
              >
                Back
              </Button>
              <Button
                className="flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700"
                onClick={handleRequestCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Submitting...' : 'Send Cancel Request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
