'use client'

import { useState } from 'react'
import { Search, LayoutGrid, Coffee, Utensils, Cookie, CupSoda, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
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

  const getCategoryCount = (cat: string) => {
    if (cat === 'All') return products.length
    return products.filter((p) => p.category === cat).length
  }

  const getCategoryIcon = (cat: string) => {
    const iconClass = 'h-6 w-6'
    switch (cat.toLowerCase()) {
      case 'all':
        return <LayoutGrid className={iconClass} />
      case 'kopi':
        return <Coffee className={iconClass} />
      case 'makanan':
        return <Utensils className={iconClass} />
      case 'snack':
        return <Cookie className={iconClass} />
      case 'minuman':
        return <CupSoda className={iconClass} />
      default:
        return <Package className={iconClass} />
    }
  }

  return (
    <div className="custom-scrollbar flex flex-1 flex-col overflow-hidden p-6 lg:p-8">
      {/* Header + Search */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="shrink-0">
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
        <div className="relative w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search product here..."
            className="bg-card h-10 rounded-xl border-none pl-10 shadow-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Category Bar */}
      <div className="custom-scrollbar mb-6 flex gap-3 overflow-x-auto pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'flex min-w-[100px] shrink-0 flex-col items-center justify-center gap-1 rounded-2xl px-4 py-4 transition-all duration-200',
              activeCategory === cat
                ? 'bg-primary/10 text-primary border-primary/30 border shadow-sm'
                : 'bg-card text-muted-foreground hover:bg-muted border border-transparent shadow-sm',
            )}
          >
            {getCategoryIcon(cat)}
            <span
              className={cn(
                'text-sm leading-tight',
                activeCategory === cat ? 'font-bold' : 'font-medium',
              )}
            >
              {cat}
            </span>
            <span className="text-[10px] opacity-60">{getCategoryCount(cat)} Items</span>
          </button>
        ))}
      </div>

      {/* Product Grid */}
      <div className="custom-scrollbar -m-2 grid flex-1 auto-rows-max grid-cols-2 gap-4 overflow-y-auto p-2 pb-20 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4">
        {filteredProducts.map((product, index) => (
          <Card
            key={product.id}
            className="animate-slide-in-card group bg-card relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 border-transparent shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            style={{ animationDelay: `${index * 40}ms` }}
          >
            {/* Image */}
            <div className="relative p-3 pb-0">
              <div className="bg-muted/30 aspect-4/3 w-full overflow-hidden rounded-xl">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                    No Image
                  </div>
                )}
              </div>

              {/* Category Badge */}
              <div className="bg-background/95 text-foreground absolute top-5 left-5 rounded-md px-2 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md">
                {product.category}
              </div>
            </div>

            {/* Info */}
            <div className="flex flex-1 flex-col p-4 pt-3">
              <h3 className="text-foreground mb-1.5 line-clamp-2 text-sm leading-snug font-bold">
                {product.name}
              </h3>

              <div className="text-primary mb-3 text-base font-bold">
                {formatRupiah(product.price)}
              </div>

              {/* Add to Dish Button */}
              <div className="mt-auto">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onAddToCart(product)
                  }}
                  className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground w-full rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
                >
                  Add Item
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
