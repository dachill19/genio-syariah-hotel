'use client'

import { create } from 'zustand'
import { Order, PaymentStatus, KitchenStatus } from '@/types/pos'

interface OrderState {
  orders: Order[]
  addOrder: (order: Order) => void
  updateOrderStatus: (
    invoiceNumber: string,
    paymentStatus?: PaymentStatus,
    kitchenStatus?: KitchenStatus,
  ) => void
  clearOrders: () => void
}

export const useOrderStore = create<OrderState>()((set) => ({
  orders: [],

  addOrder: (order) => {
    const newOrder: Order = {
      ...order,
      payment_status: order.payment_status || ('PAID' as PaymentStatus),
      kitchen_status: order.kitchen_status || ('NEW' as KitchenStatus),
    }
    set((state) => ({ orders: [newOrder, ...state.orders] }))
  },

  updateOrderStatus: (invoiceNumber, paymentStatus?, kitchenStatus?) => {
    set((state) => ({
      orders: state.orders.map((order) => {
        if (order.invoice_number !== invoiceNumber) return order
        return {
          ...order,
          ...(paymentStatus && { payment_status: paymentStatus }),
          ...(kitchenStatus && { kitchen_status: kitchenStatus }),
        }
      }),
    }))
  },

  clearOrders: () => set({ orders: [] }),
}))
