'use client'

import { useState } from 'react'
import { Search, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Product } from '@/types/pos'
import { formatRupiah, cn } from '@/lib/utils'

interface ProductGridProps {
  products: Product[]
  onAddToCart: (product: Product) => void
}

export function ProductGrid({ products, onAddToCart }: ProductGridProps) {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))]

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold">Choose Menu</h1>
          <p className="text-muted-foreground text-sm">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
          <Input
            placeholder="Search menu..."
            className="bg-card pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={activeCategory === cat ? 'default' : 'outline'}
            onClick={() => setActiveCategory(cat)}
            className="rounded-full"
            size="sm"
          >
            {cat}
          </Button>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto pb-20 md:grid-cols-3 lg:grid-cols-4">
        {filteredProducts.map((product) => {
          return (
            <Card
              key={product.id}
              onClick={() => onAddToCart(product)}
              className="hover:border-primary/50 relative flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
            >
              <div className="bg-muted relative h-40 w-full">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center">
                    No Image
                  </div>
                )}

                <Badge
                  variant="outline"
                  className="absolute top-2 right-2 border-white/20 bg-black/40 text-white backdrop-blur-md"
                >
                  {product.category}
                </Badge>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <h3 className="text-foreground line-clamp-2 text-base leading-tight font-bold">
                    {product.name}
                  </h3>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div className="text-primary text-lg font-bold">
                    {formatRupiah(product.price)}
                  </div>
                  <div className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground flex h-8 w-8 items-center justify-center rounded-full transition-colors">
                    <Plus className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
