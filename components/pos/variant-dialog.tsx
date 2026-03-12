'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Product, VariantOption } from '@/types/pos'
import { formatRupiah, cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface VariantDialogProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
  onConfirm: (
    product: Product,
    selections: Record<string, VariantOption>,
    finalPrice: number,
  ) => void
}

export function VariantDialog({ product, isOpen, onClose, onConfirm }: VariantDialogProps) {
  const [selections, setSelections] = useState<Record<string, VariantOption>>({})

  useEffect(() => {
    if (isOpen && product && product.variants) {
      const initialSelections: Record<string, VariantOption> = {}
      product.variants.forEach((group) => {
        if (group.options.length > 0) {
          initialSelections[group.name] = group.options[0]
        }
      })
      setSelections(initialSelections)
    }
  }, [isOpen, product])

  if (!product) return null

  const totalVariantPrice = Object.values(selections).reduce(
    (acc, opt) => acc + (opt.price || 0),
    0,
  )
  const finalPrice = product.price + totalVariantPrice

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-card flex max-h-[90vh] max-w-md flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="bg-muted/50 border-b p-6">
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Customize your order options</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {product.variants?.map((group) => (
            <div key={group.name} className="space-y-3">
              <h4 className="text-foreground text-sm font-semibold tracking-wider uppercase">
                {group.name}
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {group.options.map((option) => {
                  const isSelected = selections[group.name]?.name === option.name
                  return (
                    <div
                      key={option.name}
                      onClick={() => setSelections({ ...selections, [group.name]: option })}
                      className={cn(
                        'flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary ring-primary ring-1'
                          : 'border-border hover:border-muted-foreground/30 hover:bg-muted/50',
                      )}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">{option.name}</span>
                        {option.price > 0 && (
                          <span className="text-muted-foreground text-xs">
                            +{formatRupiah(option.price)}
                          </span>
                        )}
                      </div>
                      {isSelected && <Check className="text-primary h-4 w-4" />}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="bg-muted/50 border-t p-4">
          <Button
            className="h-12 w-full justify-between px-6 text-base"
            onClick={() => onConfirm(product, selections, finalPrice)}
          >
            <span>Add to Cart</span>
            <span>{formatRupiah(finalPrice)}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
