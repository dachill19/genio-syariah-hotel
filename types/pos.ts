import type { AppRole } from '@/lib/access-control'

export interface VariantOption {
  name: string
  price: number
}

export interface VariantGroup {
  name: string
  options: VariantOption[]
}

export interface Unit {
  id: number
  name: string
  type: 'CAFE' | 'RESTO' | 'FO' | 'FINANCE'
  tax_rate: number
}

export interface User {
  id: string
  unit_id?: number
  username: string
  role: AppRole
}

export interface Product {
  id: number
  unit_id: number
  name: string
  price: number
  category: string
  image?: string
  variants?: VariantGroup[]
}

export interface CartItem extends Product {
  qty: number
  selectedVariants?: Record<string, VariantOption>
  totalPrice: number
  note?: string
}

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED' | 'VOID' | 'CANCELLED'
export type KitchenStatus = 'NEW' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELED'

export type OrderType = 'Dine in' | 'Take Away'

export interface Order {
  id?: string
  unit_id?: number
  user_id?: string
  invoice_number: string
  description?: string
  created_at: string
  grand_total: number
  subtotal: number
  tax_amount: number
  payment_method: string
  items: CartItem[]
  cashier_name?: string
  payment_status?: PaymentStatus
  kitchen_status?: KitchenStatus
  table_number?: string
  customer_name?: string
  order_type?: OrderType
}

export interface Staff {
  id: number
  name: string
}
