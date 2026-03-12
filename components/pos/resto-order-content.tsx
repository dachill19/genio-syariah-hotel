'use client'

import { useState, useEffect, useRef } from 'react'
import { ProductGrid } from '@/components/pos/product-grid'
import { CartSidebar } from '@/components/pos/cart-sidebar'
import { VariantDialog } from '@/components/pos/variant-dialog'
import { Product, CartItem, VariantOption, Order, OrderType } from '@/types/pos'
import { useOrderStore } from '@/stores/order-store'
import { useAuthStore } from '@/stores/auth-store'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

interface RestoOrderContentProps {
  unitId: number
  unitName: string
}

export function RestoOrderContent({ unitId, unitName }: RestoOrderContentProps) {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tableFromUrl = searchParams.get('table') || ''
  const orderIdFromUrl = searchParams.get('orderId')

  const { addOrder } = useOrderStore()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [taxRate, setTaxRate] = useState(0)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isVariantOpen, setIsVariantOpen] = useState(false)

  const [tableNumber, setTableNumber] = useState(tableFromUrl)
  const [customerName, setCustomerName] = useState('')
  const [showValidation, setShowValidation] = useState(false)

  const pendingProductRef = useRef<Product | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  useEffect(() => {
    async function initData() {
      try {
        const unitRes = await fetch(`/api/units/${unitId}`)
        if (unitRes.ok) {
          const unitData = await unitRes.json()
          setTaxRate(Number(unitData.tax_rate) || 0)
        }

        const prodRes = await fetch(`/api/products?unitId=${unitId}`)
        if (!prodRes.ok) throw new Error('Failed to fetch products')
        const prodData = await prodRes.json()
        setProducts(prodData)
      } catch (error) {
        console.error('Error loading initial data:', error)
      }
    }
    initData()
  }, [unitId])

  useEffect(() => {
    if (orderIdFromUrl) {
      fetch(`/api/orders/${orderIdFromUrl}`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.customer_name) {
            setCustomerName(data.customer_name)
          }
          if (data && data.items && Array.isArray(data.items)) {
            const existingItems: CartItem[] = data.items.map((item: any) => ({
              id: item.id,
              unit_id: unitId,
              name: item.name,
              price: item.price,
              category: '',
              qty: item.qty,
              selectedVariants: item.selectedVariants || {},
              totalPrice: item.totalPrice || item.price,
            }))
            setCart(existingItems)
          }
        })
        .catch((err) => console.error('Failed to load existing order', err))
    }
  }, [orderIdFromUrl, unitId])

  const isCustomerInfoFilled = () => {
    return tableNumber.trim() !== '' && customerName.trim() !== ''
  }

  const handleProductClick = (product: Product) => {
    if (!isCustomerInfoFilled()) {
      setShowValidation(true)
      pendingProductRef.current = product
      return
    }

    if (product.variants && product.variants.length > 0) {
      setSelectedProduct(product)
      setIsVariantOpen(true)
    } else {
      addToCart(product, {}, product.price)
    }
  }

  const handleCustomerInfoSaved = () => {
    setShowValidation(false)
    if (pendingProductRef.current) {
      const product = pendingProductRef.current
      pendingProductRef.current = null
      if (product.variants && product.variants.length > 0) {
        setSelectedProduct(product)
        setIsVariantOpen(true)
      } else {
        addToCart(product, {}, product.price)
      }
    }
  }

  const addToCart = (
    product: Product,
    selectedVariants: Record<string, VariantOption>,
    finalPrice: number,
  ) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) =>
          item.id === product.id &&
          JSON.stringify(item.selectedVariants) === JSON.stringify(selectedVariants),
      )

      if (existingIndex >= 0) {
        return prev.map((item, i) => (i === existingIndex ? { ...item, qty: item.qty + 1 } : item))
      }
      return [...prev, { ...product, qty: 1, selectedVariants, totalPrice: finalPrice }]
    })

    setIsVariantOpen(false)
    setSelectedProduct(null)
  }

  const updateQty = (index: number, delta: number) => {
    setCart((prev) => {
      const newCart = prev
        .map((item, i) => {
          if (i === index) {
            return { ...item, qty: item.qty + delta }
          }
          return item
        })
        .filter((item) => item.qty > 0)
      return newCart
    })
  }

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const handleCheckout = async (
    method: string,
    tableNum: string,
    custName: string,
    orderType: OrderType,
  ) => {
    if (cart.length === 0) return

    const subtotal = cart.reduce((acc, item) => acc + item.totalPrice * item.qty, 0)
    const tax_amount = subtotal * taxRate
    const grand_total = subtotal + tax_amount

    try {
      if (orderIdFromUrl) {
        const res = await fetch(`/api/orders/${orderIdFromUrl}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cart,
            subtotal,
            tax_amount,
            grand_total,
          }),
        })
        if (res.ok) {
          router.push('/pos/restaurant')
        } else {
          const data = await res.json()
          alert(`Update failed: ${data.error}`)
        }
      } else {
        const payload = {
          items: cart,
          subtotal,
          tax_amount,
          grand_total,
          payment_method: method || 'PENDING',
          payment_status: 'UNPAID',
          table_number: tableNum,
          customer_name: custName,
          order_type: orderType,
          unit_id: unitId,
          user_id: user?.id,
        }

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        const data = await res.json()

        if (res.ok) {
          const order: Order = {
            ...payload,
            invoice_number: data.invoice_number,
            cashier_name: data.cashier_name,
            created_at: data.created_at,
            payment_status: 'UNPAID',
            kitchen_status: 'NEW',
          }

          addOrder(order)
          router.push('/pos/restaurant')
        } else {
          alert(`Order failed: ${data.error}`)
        }
      }
    } catch (error) {
      console.error('Order error:', error)
      alert('Failed to process order. Check console.')
    }
  }

  if (!isAuthenticated) return null

  return (
    <main className="bg-muted relative flex h-screen w-full">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        {/* Back button */}
        <div className="flex items-center gap-3 bg-white px-6 py-3 shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={() => router.push('/pos/restaurant')}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Floor Plan
          </Button>
          {tableFromUrl && (
            <span className="text-muted-foreground text-sm">
              Table <span className="text-foreground font-bold">{tableFromUrl}</span>
            </span>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <ProductGrid products={products} onAddToCart={handleProductClick} />
        </div>
      </div>

      <CartSidebar
        items={cart}
        onUpdateQty={updateQty}
        onRemove={removeFromCart}
        onCheckout={handleCheckout}
        taxRate={taxRate}
        tableNumber={tableNumber}
        customerName={customerName}
        onTableNumberChange={setTableNumber}
        onCustomerNameChange={setCustomerName}
        showValidation={showValidation}
        onCustomerInfoSaved={handleCustomerInfoSaved}
        mode="resto"
      />

      <VariantDialog
        product={selectedProduct}
        isOpen={isVariantOpen}
        onClose={() => setIsVariantOpen(false)}
        onConfirm={addToCart}
      />
    </main>
  )
}
