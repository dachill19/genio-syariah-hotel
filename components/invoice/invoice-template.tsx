import { Order } from '@/types/pos'
import { formatRupiah } from '@/lib/utils'

interface InvoiceTemplateProps {
  order: Order
}

export function InvoiceTemplate({ order }: InvoiceTemplateProps) {
  return (
    <div className="w-[80mm] bg-white px-4 pt-5 pb-6 font-mono text-sm leading-tight text-black">
      <div className="mb-4 flex flex-col items-center justify-center text-center">
        <img src="/img/logo.png" alt="Logo" className="mb-2 h-14 w-auto contrast-125 grayscale" />
        <h1 className="text-xl font-bold">{order.unit_id === 2 ? 'AXL Resto' : 'AXL Coffee'}</h1>
        <p className="text-xs">Jl. Adisucipto, Colomadu</p>
      </div>

      <div className="mb-2 border-b border-dashed border-black pb-2 text-xs">
        <p>No: {order.invoice_number}</p>
        <p>
          Date:{' '}
          {new Date(order.created_at).toLocaleString('id-ID', {
            day: 'numeric',
            month: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </p>
        <p>Cashier: {order.cashier_name || '-'}</p>
        <p>Customer: {order.customer_name || '-'}</p>
        <p>Table: {order.table_number || '-'}</p>
      </div>

      <div className="mb-2 border-b border-dashed border-black pb-2">
        {order.items &&
          order.items.map((item, idx) => (
            <div key={idx} className="mb-2">
              <p className="font-bold">{item.name}</p>
              {item.selectedVariants &&
                Object.values(item.selectedVariants).map((v: any) => (
                  <p key={v.name} className="ml-2 text-xs italic">
                    - {v.name}
                  </p>
                ))}
              <div className="flex justify-between">
                <span>
                  {item.qty} x {formatRupiah(item.price || 0)}
                </span>
                <span>{formatRupiah((item.price || 0) * item.qty)}</span>
              </div>
            </div>
          ))}
      </div>

      <div className="mb-4 text-xs font-medium">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatRupiah(order.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>{formatRupiah(order.tax_amount)}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-lg font-bold">
          <span>TOTAL</span>
          <span>{formatRupiah(order.grand_total)}</span>
        </div>
        <div className="mt-1 flex justify-between text-xs">
          <span>Payment Method</span>
          <span className="uppercase">{order.payment_method}</span>
        </div>
      </div>

      <div className="mt-2 text-center text-xs">
        <p className="font-bold italic">Thank You!</p>
        <p className="italic">Please save this receipt as proof of payment</p>
      </div>
    </div>
  )
}
