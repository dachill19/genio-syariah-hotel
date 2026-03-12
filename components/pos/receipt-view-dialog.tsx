'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Order } from '@/types/pos'
import { InvoiceTemplate } from '@/components/invoice/invoice-template'

interface ReceiptViewDialogProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
}

export function ReceiptViewDialog({ order, isOpen, onClose }: ReceiptViewDialogProps) {
  if (!order) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-muted max-w-sm overflow-hidden p-6 sm:max-w-md">
        <DialogTitle className="sr-only">View Receipt</DialogTitle>
        <div className="flex justify-center">
          <div className="w-[80mm] overflow-hidden rounded-xl border opacity-95 shadow-xl transition-opacity hover:opacity-100">
            <InvoiceTemplate order={order} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
