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
  id: number
  unit_id?: number
  username: string
  role: 'CASHIER' | 'MANAGER' | 'FINANCE' | 'ADMIN'
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
}

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'COMPLETED' | 'CANCELLED'

export type OrderType = 'Dine in' | 'Take Away'

export interface Order {
  id?: number
  unit_id?: number
  user_id?: number
  invoice_number: string
  created_at: string
  grand_total: number
  subtotal: number
  tax_amount: number
  payment_method: string
  items: CartItem[]
  cashier_name?: string
  status?: OrderStatus
  table_number?: string
  customer_name?: string
  order_type?: OrderType
}

export interface Staff {
  id: number
  name: string
}
