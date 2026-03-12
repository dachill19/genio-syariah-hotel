'use client'

import { useState, useEffect } from 'react'
import { Minus, Plus, Edit2, CreditCard, Banknote, QrCode, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatRupiah, cn } from '@/lib/utils'
import { CartItem, OrderType } from '@/types/pos'

interface CartSidebarProps {
  items: CartItem[]
  onUpdateQty: (id: number, delta: number) => void
  onRemove: (id: number) => void
  onCheckout: (
    paymentMethod: string,
    tableNumber: string,
    customerName: string,
    orderType: OrderType,
  ) => void
  taxRate: number
  tableNumber: string
  customerName: string
  onTableNumberChange: (value: string) => void
  onCustomerNameChange: (value: string) => void
  showValidation: boolean
  onCustomerInfoSaved: () => void
  mode?: 'cafe' | 'resto'
}

type PaymentMethod = 'CASH' | 'CARD' | 'QRIS'

export function CartSidebar({
  items,
  onUpdateQty,
  onRemove,
  onCheckout,
  taxRate,
  tableNumber,
  customerName,
  onTableNumberChange,
  onCustomerNameChange,
  showValidation,
  onCustomerInfoSaved,
  mode = 'cafe',
}: CartSidebarProps) {
  const isResto = mode === 'resto'
  const [orderType, setOrderType] = useState<OrderType>('Dine in')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')
  const [isEditing, setIsEditing] = useState(false)

  const hasCustomerInfo = tableNumber.trim() !== '' && customerName.trim() !== ''

  useEffect(() => {
    if (showValidation) {
      setIsEditing(true)
    }
  }, [showValidation])

  const handleSave = () => {
    if (hasCustomerInfo) {
      setIsEditing(false)
      onCustomerInfoSaved()
    }
  }

  const subtotal = items.reduce((acc, item) => acc + item.totalPrice * item.qty, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax

  return (
    <div className="bg-card z-20 flex h-full w-[380px] flex-col border-l shadow-xl">
      {/* Header: Table + Customer */}
      <div
        className={cn(
          'flex items-center justify-between border-b p-5 pb-4 transition-all',
          showValidation && !hasCustomerInfo && 'bg-red-50/50',
        )}
      >
        <div className="flex-1 space-y-2">
          {isEditing ? (
            <div className="animate-in slide-in-from-left-2 space-y-2.5 duration-300">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-14 text-xs font-semibold tracking-wide uppercase">
                  Table
                </span>
                <Input
                  className={cn(
                    'bg-muted/50 h-8 rounded-lg border text-sm',
                    showValidation && tableNumber.trim() === ''
                      ? 'border-red-400 bg-red-50/50'
                      : 'border-transparent',
                    isResto && 'cursor-not-allowed opacity-60',
                  )}
                  value={tableNumber}
                  onChange={(e) => onTableNumberChange(e.target.value)}
                  placeholder="Table No."
                  autoFocus={!isResto}
                  readOnly={isResto}
                  disabled={isResto}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-14 text-xs font-semibold tracking-wide uppercase">
                  Name
                </span>
                <Input
                  className={cn(
                    'bg-muted/50 h-8 rounded-lg border text-sm',
                    showValidation && customerName.trim() === ''
                      ? 'border-red-400 bg-red-50/50'
                      : 'border-transparent',
                  )}
                  value={customerName}
                  onChange={(e) => onCustomerNameChange(e.target.value)}
                  placeholder="Customer Name"
                />
              </div>
              {showValidation && !hasCustomerInfo && (
                <p className="text-xs font-medium text-red-500">
                  Please fill in table number and customer name first
                </p>
              )}
              <Button
                size="sm"
                className="mt-1 h-8 w-full gap-1.5 rounded-lg text-xs"
                disabled={!hasCustomerInfo}
                onClick={handleSave}
              >
                <Check className="h-3.5 w-3.5" />
                Save
              </Button>
            </div>
          ) : hasCustomerInfo ? (
            <div className="space-y-0.5">
              <h2 className="text-foreground text-xl font-bold">Table {tableNumber}</h2>
              <p className="text-muted-foreground text-sm">{customerName}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              <h2 className="text-muted-foreground text-lg font-medium italic">Not filled yet</h2>
              <p className="text-muted-foreground/60 text-xs">Click ✏️ to fill table & name</p>
            </div>
          )}
        </div>
        {!isEditing && (
          <button
            className={cn(
              'ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all',
              !hasCustomerInfo
                ? 'bg-primary/15 text-primary animate-pulse'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted',
            )}
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Order Type Toggle */}
      <div className="px-5 pt-4 pb-2">
        <div className="bg-muted/40 flex w-full rounded-xl p-1">
          {(['Dine in', 'Take Away'] as OrderType[]).map((type) => (
            <button
              key={type}
              onClick={() => setOrderType(type)}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-200',
                orderType === type
                  ? 'bg-primary/10 text-primary font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Cart Items */}
      <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-5 py-3">
        {items.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center text-center opacity-40">
            <div className="mb-2 text-4xl">🍽️</div>
            <p className="text-base font-medium">No items ordered</p>
            <p className="text-sm">Select items from the menu</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="animate-fade-in-up bg-card flex gap-3 rounded-2xl border p-3 shadow-sm transition-all hover:shadow-md"
            >
              {/* Thumbnail */}
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-[10px]">
                    No Img
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="flex flex-1 flex-col justify-between gap-1">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-foreground line-clamp-2 text-sm leading-tight font-semibold">
                    {item.name}
                  </h4>
                  <span className="text-foreground shrink-0 text-sm font-bold">
                    {formatRupiah(item.totalPrice * item.qty)}
                  </span>
                </div>

                {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                  <p className="text-muted-foreground line-clamp-1 text-xs">
                    {Object.values(item.selectedVariants)
                      .map((opt: any) => opt.name)
                      .join(', ')}
                  </p>
                )}

                <div className="flex items-center justify-between pt-0.5">
                  <div className="text-primary text-xs font-medium">
                    {formatRupiah(item.totalPrice)}
                    <span className="text-muted-foreground ml-2 text-[11px]">{item.qty}x</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onUpdateQty(index, -1)}
                      className="bg-muted/60 hover:bg-muted flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
                    <button
                      onClick={() => onUpdateQty(index, 1)}
                      className="bg-muted/60 hover:bg-muted flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Summary + Payment + Place Order */}
      <div className="bg-card z-10 space-y-4 border-t p-5 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.08)]">
        {/* Totals */}
        <div className="space-y-1.5">
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Sub Total</span>
            <span className="font-medium">{formatRupiah(subtotal)}</span>
          </div>
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Tax {taxRate * 100}%</span>
            <span className="font-medium">{formatRupiah(tax)}</span>
          </div>

          <div className="my-2 border-t border-dashed" />

          <div className="text-foreground flex justify-between text-lg font-bold">
            <span>Total Amount</span>
            <span>{formatRupiah(total)}</span>
          </div>
        </div>

        {/* Payment Methods (hidden in resto mode) */}
        {!isResto && (
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { key: 'CASH' as PaymentMethod, icon: Banknote, label: 'Cash' },
              { key: 'CARD' as PaymentMethod, icon: CreditCard, label: 'Debit/Credit' },
              { key: 'QRIS' as PaymentMethod, icon: QrCode, label: 'QR Code' },
            ].map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                onClick={() => setPaymentMethod(key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-200',
                  paymentMethod === key
                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                    : 'border-muted text-muted-foreground hover:bg-muted/30 hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[11px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Place Order Button */}
        <Button
          className="w-full rounded-2xl py-6 text-base font-bold shadow-lg transition-all hover:shadow-xl"
          size="lg"
          disabled={items.length === 0}
          onClick={() =>
            onCheckout(isResto ? 'PENDING' : paymentMethod, tableNumber, customerName, orderType)
          }
        >
          Place Order
        </Button>
      </div>
    </div>
  )
}
