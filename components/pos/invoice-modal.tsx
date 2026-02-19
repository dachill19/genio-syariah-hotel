'use client'

import { useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Order } from '@/types/pos'
import { Download, X } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import { InvoiceTemplate } from '@/components/invoice/invoice-template'

interface InvoiceModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
}

export function InvoiceModal({ order, isOpen, onClose }: InvoiceModalProps) {
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
      const pdfWidth = 80
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
        <DialogTitle className="sr-only">Invoice {order.invoice_number}</DialogTitle>

        <div className="flex items-center justify-between border-b bg-gray-50 px-4 py-3">
          <h3 className="font-semibold text-gray-900">Invoice Details</h3>
        </div>

        <div className="flex max-h-[70vh] flex-col overflow-y-auto bg-gray-50 p-6">
          <div className="mx-auto mb-6 w-[80mm] shadow-lg">
            <div ref={invoiceRef} className="bg-white text-black">
              <InvoiceTemplate order={order} />
            </div>
          </div>
        </div>

        <div className="border-t bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="w-full gap-2" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
            <Button className="w-full gap-2" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
