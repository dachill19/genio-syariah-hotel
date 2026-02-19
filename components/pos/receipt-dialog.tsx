'use client'

import { useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatRupiah } from '@/lib/utils'
import { Order } from '@/types/pos'
import { Check, Download, RefreshCw } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { InvoiceTemplate } from '@/components/invoice/invoice-template'

interface ReceiptDialogProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onNewOrder: () => void
}

export function ReceiptDialog({ order, isOpen, onClose, onNewOrder }: ReceiptDialogProps) {
  const invoiceRef = useRef<HTMLDivElement>(null)

  if (!order) return null

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdfWidth = 80 // mm
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight],
      })

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(`invoice-${order.invoice_number}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden border-none bg-white p-0 shadow-2xl">
        <DialogTitle className="sr-only">Receipt</DialogTitle>
        <div className="bg-green-500 p-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <Check className="h-8 w-8" />
          </div>
          <h3 className="text-2xl font-bold">Payment Success!</h3>
          <p className="mt-1 font-mono opacity-90">{order.invoice_number}</p>
        </div>

        <div className="flex-1 bg-gray-50 p-6">
          <div className="mb-6 space-y-3 rounded-xl border border-gray-100 bg-white p-4 text-sm shadow-sm">
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">
                {new Date(order.created_at).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Table</span>
              <span className="font-bold text-gray-900">{order.table_number || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Customer</span>
              <span className="font-bold text-gray-900">{order.customer_name || '-'}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-gray-500">Type</span>
              <span className="font-bold text-gray-900">{order.order_type || '-'}</span>
            </div>

            <div className="flex justify-between pt-2">
              <span className="text-gray-500">Method</span>
              <span className="font-bold text-gray-900">{order.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cashier</span>
              <span className="font-bold text-gray-900">{order.cashier_name || 'System'}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-base">
              <span className="font-bold text-gray-700">Tax</span>
              <span className="text-gray-900">{formatRupiah(order.tax_amount)}</span>
            </div>
            <div className="flex justify-between pt-1 text-base">
              <span className="font-bold text-gray-700">Total</span>
              <span className="text-primary font-bold">{formatRupiah(order.grand_total)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button className="w-full gap-2" onClick={onNewOrder}>
              <RefreshCw className="h-4 w-4" /> New Order
            </Button>
          </div>
        </div>

        <div className="fixed top-0 left-[-9999px]">
          <div ref={invoiceRef} className="w-[80mm] bg-white text-black">
            <InvoiceTemplate order={order} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
