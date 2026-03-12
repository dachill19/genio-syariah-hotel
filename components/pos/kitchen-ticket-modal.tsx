'use client'

import { useRef } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface KitchenTicketModalProps {
  order: any | null
  isOpen: boolean
  onClose: () => void
}

export function KitchenTicketModal({ order, isOpen, onClose }: KitchenTicketModalProps) {
  const ticketRef = useRef<HTMLDivElement>(null)

  if (!order) return null

  const items = Array.isArray(order.items) ? order.items : []

  const handleDownloadPDF = async () => {
    if (!ticketRef.current) return

    try {
      const canvas = await html2canvas(ticketRef.current, {
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
      pdf.save(`ticket-${order.invoice_number}.pdf`)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate PDF')
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card max-w-sm overflow-hidden border-none p-0 shadow-2xl">
        <DialogTitle className="sr-only">Kitchen Ticket {order.invoice_number}</DialogTitle>

        <div className="bg-muted/50 flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-foreground font-semibold">Kitchen Ticket</h3>
        </div>

        <div className="bg-muted/50 flex max-h-[70vh] flex-col overflow-y-auto p-6">
          <div className="mx-auto mb-6 w-[80mm] shadow-lg">
            <div ref={ticketRef} className="bg-white text-black">
              {/* Ticket Content */}
              <div className="w-[80mm] bg-white px-4 pt-5 pb-6 font-mono text-sm leading-tight text-black">
                <div className="mb-4 text-center">
                  <h1 className="text-xl font-bold">🍳 KITCHEN ORDER</h1>
                  <p className="text-xs">
                    {new Date(order.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>

                <div className="mb-2 border-b border-dashed border-black pb-2 text-xs">
                  <p>Table: {order.table_number || '-'}</p>
                  <p>Customer: {order.customer_name || '-'}</p>
                  <p>Type: {order.order_type || 'Dine in'}</p>
                  <p>Invoice: {order.invoice_number}</p>
                </div>

                <div className="mb-2 border-b border-dashed border-black pb-2">
                  {items.map((item: any, idx: number) => {
                    const variants = item.selectedVariants
                      ? Object.values(item.selectedVariants).map((v: any) => v.name)
                      : []
                    return (
                      <div key={idx} className="mb-2">
                        <p className="font-bold">{item.name}</p>
                        {variants.length > 0 &&
                          variants.map((v: string) => (
                            <p key={v} className="ml-2 text-xs italic">
                              - {v}
                            </p>
                          ))}
                        <p>{item.qty} x item</p>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-2 text-center text-xs">
                  <p className="font-bold italic">--- Kitchen Copy ---</p>
                  <p className="italic">Please prepare this order</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border-t p-4">
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
