'use client'

import { useState } from 'react'
import { Trash2, Minus, Plus, Edit2, CreditCard, Banknote, QrCode } from 'lucide-react'
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
}

type PaymentMethod = 'CASH' | 'CARD' | 'QRIS'

export function CartSidebar({
  items,
  onUpdateQty,
  onRemove,
  onCheckout,
  taxRate,
}: CartSidebarProps) {
  const [orderType, setOrderType] = useState<OrderType>('Dine in')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH')

  const [isEditing, setIsEditing] = useState(false)
  const [tableNumber, setTableNumber] = useState('4')
  const [customerName, setCustomerName] = useState('Floyd Miles')

  const subtotal = items.reduce((acc, item) => acc + item.totalPrice * item.qty, 0)
  const tax = subtotal * taxRate
  const total = subtotal + tax

  return (
    <div className="bg-card z-20 flex h-full w-[400px] flex-col border-l shadow-xl">
      <div className="flex items-start justify-between border-b p-6">
        <div className="flex-1 space-y-3">
          {isEditing ? (
            <div className="animate-in slide-in-from-left-2 space-y-3 duration-300">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-12 text-sm font-medium">Meja</span>
                <Input
                  className="bg-background border-muted h-9"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground w-12 text-sm font-medium">Nama</span>
                <Input
                  className="bg-background border-muted h-9"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nama Pelanggan"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <h2 className="text-2xl font-bold">Table {tableNumber}</h2>
              <p className="text-muted-foreground text-sm font-medium">{customerName}</p>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'bg-muted/50 hover:bg-muted ml-4 h-10 w-10 shrink-0 rounded-full',
            isEditing && 'bg-primary/20 text-primary',
          )}
          onClick={() => setIsEditing(!isEditing)}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 pb-0">
        <div className="bg-muted/50 flex w-full rounded-xl p-1">
          {(['Dine in', 'Take Away'] as OrderType[]).map((type) => (
            <Button
              key={type}
              variant={orderType === type ? 'default' : 'ghost'}
              onClick={() => setOrderType(type)}
              className={cn(
                'flex-1 rounded-lg text-sm font-medium transition-all',
                orderType !== type &&
                  'text-muted-foreground hover:text-foreground hover:bg-transparent',
              )}
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center text-center opacity-50">
            <p className="text-lg font-medium">No items ordered</p>
            <p className="text-sm">Select items from the menu to add them here.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              className="bg-card hover:bg-muted/20 flex gap-4 rounded-xl border p-3 shadow-sm transition-all"
            >
              <div className="bg-muted h-16 w-16 overflow-hidden rounded-lg">
                {item.image ? (
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs">
                    No Img
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col justify-between">
                <div className="flex justify-between gap-2">
                  <h4 className="line-clamp-2 text-sm leading-tight font-semibold">{item.name}</h4>
                  <span className="shrink-0 text-sm font-bold">
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

                <div className="flex items-center gap-3 pt-1">
                  <div className="text-primary text-xs font-medium">
                    {formatRupiah(item.totalPrice)}
                  </div>
                  <div className="bg-muted/50 ml-auto flex items-center gap-2 rounded-lg px-1 py-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onUpdateQty(index, -1)}
                      className="hover:bg-background h-6 w-6 rounded shadow-none"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-4 text-center text-xs font-bold">{item.qty}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onUpdateQty(index, 1)}
                      className="hover:bg-background h-6 w-6 rounded shadow-none"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="bg-card space-y-4 border-t p-6">
        <div className="space-y-2">
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Sub Total</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
          <div className="text-muted-foreground flex justify-between text-sm">
            <span>Tax {taxRate * 100}%</span>
            <span>{formatRupiah(tax)}</span>
          </div>

          <div className="my-2 border-t border-dashed" />

          <div className="text-foreground flex justify-between text-xl font-bold">
            <span>Total Amount</span>
            <span>{formatRupiah(total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Button
            variant="outline"
            onClick={() => setPaymentMethod('CASH')}
            className={cn(
              'h-auto flex-col gap-2 rounded-xl p-3',
              paymentMethod === 'CASH'
                ? 'border-primary bg-primary/5 text-primary ring-primary ring-1'
                : 'border-muted hover:bg-muted/50 text-muted-foreground',
            )}
          >
            <Banknote className="h-6 w-6" />
            <span className="text-xs font-medium">Cash</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setPaymentMethod('CARD')}
            className={cn(
              'h-auto flex-col gap-2 rounded-xl p-3',
              paymentMethod === 'CARD'
                ? 'border-primary bg-primary/5 text-primary ring-primary ring-1'
                : 'border-muted hover:bg-muted/50 text-muted-foreground',
            )}
          >
            <CreditCard className="h-6 w-6" />
            <span className="text-xs font-medium">Debit/Credit</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setPaymentMethod('QRIS')}
            className={cn(
              'h-auto flex-col gap-2 rounded-xl p-3',
              paymentMethod === 'QRIS'
                ? 'border-primary bg-primary/5 text-primary ring-primary ring-1'
                : 'border-muted hover:bg-muted/50 text-muted-foreground',
            )}
          >
            <QrCode className="h-6 w-6" />
            <span className="text-xs font-medium">QR Code</span>
          </Button>
        </div>

        <Button
          className="w-full rounded-xl py-6 text-lg font-bold shadow-lg"
          size="lg"
          disabled={items.length === 0}
          onClick={() => onCheckout(paymentMethod, tableNumber, customerName, orderType)}
        >
          Pay Now
        </Button>
      </div>
    </div>
  )
}
