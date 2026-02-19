'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { Order, OrderStatus } from '@/types/pos'

interface OrderContextType {
  orders: Order[]
  addOrder: (order: Order) => void
  updateOrderStatus: (invoiceNumber: string, status: OrderStatus) => void
}

const OrderContext = createContext<OrderContextType | undefined>(undefined)

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([])

  const addOrder = (order: Order) => {
    const newOrder = { ...order, status: 'PENDING' as OrderStatus }
    setOrders((prev) => [newOrder, ...prev])
  }

  const updateOrderStatus = (invoiceNumber: string, status: OrderStatus) => {
    setOrders((prev) =>
      prev.map((order) => (order.invoice_number === invoiceNumber ? { ...order, status } : order)),
    )
  }

  return (
    <OrderContext.Provider
      value={{
        orders,
        addOrder,
        updateOrderStatus,
      }}
    >
      {children}
    </OrderContext.Provider>
  )
}

export function useOrder() {
  const context = useContext(OrderContext)
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider')
  }
  return context
}
