'use client'

import { useState, useEffect } from 'react'
import { ProductGrid } from '@/components/pos/product-grid'
import { CartSidebar } from '@/components/pos/cart-sidebar'
import { VariantDialog } from '@/components/pos/variant-dialog'
import { ReceiptDialog } from '@/components/pos/receipt-dialog'
import { Product, CartItem, VariantOption, Order, OrderType } from '@/types/pos'
import { useOrder } from '@/context/order-context'
import { useAuth } from '@/context/auth-context'
import { useRouter } from 'next/navigation'

interface POSDashboardProps {
  unitId: number
  unitName: string
}

export function POSDashboard({ unitId, unitName }: POSDashboardProps) {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()

  const { addOrder } = useOrder()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [taxRate, setTaxRate] = useState(0)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isVariantOpen, setIsVariantOpen] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [lastOrder, setLastOrder] = useState<Order | null>(null)

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

  const handleProductClick = (product: Product) => {
    if (product.variants && product.variants.length > 0) {
      setSelectedProduct(product)
      setIsVariantOpen(true)
    } else {
      addToCart(product, {}, product.price)
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
        const newCart = [...prev]
        newCart[existingIndex].qty += 1
        return newCart
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
    tableNumber: string,
    customerName: string,
    orderType: OrderType,
  ) => {
    if (cart.length === 0) return

    const currentUser = user?.username || 'Admin'

    const subtotal = cart.reduce((acc, item) => acc + item.totalPrice * item.qty, 0)
    const tax_amount = subtotal * taxRate
    const grand_total = subtotal + tax_amount

    const payload = {
      items: cart,
      subtotal: subtotal,
      tax_amount: tax_amount,
      grand_total: grand_total,
      payment_method: method,
      table_number: tableNumber,
      customer_name: customerName,
      order_type: orderType,
      unit_id: unitId,
      user_id: user?.id,
    }

    try {
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
          status: 'PENDING',
        }

        addOrder(order)
        setLastOrder(order)
        setIsReceiptOpen(true)
        setCart([])
      } else {
        alert(`Order failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Payment error:', error)
      alert('Failed to process payment. Check console.')
    }
  }

  const handleNewOrder = () => {
    setIsReceiptOpen(false)
    setLastOrder(null)
  }

  if (!isAuthenticated) return null

  return (
    <main className="bg-muted relative flex h-screen w-full">
      <div className="flex h-full flex-1 flex-col overflow-hidden">
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
      />

      <VariantDialog
        product={selectedProduct}
        isOpen={isVariantOpen}
        onClose={() => setIsVariantOpen(false)}
        onConfirm={addToCart}
      />

      <ReceiptDialog
        order={lastOrder}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onNewOrder={handleNewOrder}
      />
    </main>
  )
}
