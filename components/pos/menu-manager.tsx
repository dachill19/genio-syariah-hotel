'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { formatRupiah, cn } from '@/lib/utils'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  UtensilsCrossed,
  Tag,
  Package,
  Save,
  FolderOpen,
} from 'lucide-react'

interface MenuManagerProps {
  unitId: number
}

interface Category {
  id: number
  name: string
  unit_id: number
}

interface Product {
  id: number
  name: string
  price: number
  cogs: number
  category_id: number | null
  category: string | null
  image: string | null
  variants: any
  is_active: number
}

export function MenuManager({ unitId }: MenuManagerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')

  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    cogs: '',
    category_id: '' as string,
    image: '',
  })

  const fetchProducts = () => {
    setLoading(true)
    fetch(`/api/products?unitId=${unitId}`)
      .then((r) => r.json())
      .then((d) => setProducts(d))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  const fetchCategories = () => {
    fetch(`/api/categories?unitId=${unitId}`)
      .then((r) => r.json())
      .then((d) => setCategories(d))
      .catch(console.error)
  }

  useEffect(() => {
    fetchProducts()
    fetchCategories()
  }, [unitId])

  const filtered = products.filter((p) => {
    const matchCategory = activeCategory === null || p.category_id === activeCategory
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchCategory && matchSearch
  })

  const openProductModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setProductForm({
        name: product.name,
        price: product.price.toString(),
        cogs: product.cogs.toString(),
        category_id: product.category_id?.toString() || '',
        image: product.image || '',
      })
    } else {
      setEditingProduct(null)
      setProductForm({ name: '', price: '', cogs: '', category_id: '', image: '' })
    }
    setShowProductModal(true)
  }

  const saveProduct = async () => {
    const body = {
      name: productForm.name,
      price: parseInt(productForm.price),
      cogs: parseInt(productForm.cogs) || 0,
      category_id: productForm.category_id ? parseInt(productForm.category_id) : null,
      unit_id: unitId,
      image: productForm.image || null,
    }

    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      setShowProductModal(false)
      fetchProducts()
    } catch (e) {
      console.error(e)
    }
  }

  const deleteProduct = async (id: number) => {
    if (!confirm('Delete this product?')) return
    try {
      await fetch(`/api/products/${id}`, { method: 'DELETE' })
      fetchProducts()
    } catch (e) {
      console.error(e)
    }
  }

  const openCategoryModal = (cat?: Category) => {
    if (cat) {
      setEditingCategory(cat)
      setCategoryName(cat.name)
    } else {
      setEditingCategory(null)
      setCategoryName('')
    }
    setShowCategoryModal(true)
  }

  const saveCategory = async () => {
    if (!categoryName.trim()) return
    try {
      if (editingCategory) {
        await fetch(`/api/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: categoryName }),
        })
      } else {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: categoryName, unit_id: unitId }),
        })
      }
      setShowCategoryModal(false)
      fetchCategories()
      fetchProducts()
    } catch (e) {
      console.error(e)
    }
  }

  const deleteCategory = async (id: number) => {
    if (!confirm('Delete this category? Products in this category will become uncategorized.')) return
    try {
      await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (activeCategory === id) setActiveCategory(null)
      fetchCategories()
      fetchProducts()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="bg-background flex h-screen flex-col overflow-hidden p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-foreground flex items-center gap-3 text-3xl font-bold">
            <div className="bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl">
              <UtensilsCrossed className="text-primary h-6 w-6" />
            </div>
            Menu Manager
          </h1>
          <p className="text-muted-foreground mt-1.5 ml-14 text-sm">
            {products.length} products · {categories.length} categories
          </p>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => openCategoryModal()}
          >
            <Tag className="mr-2 h-4 w-4" />
            Add Category
          </Button>
          <Button className="rounded-xl" onClick={() => openProductModal()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Category Tabs + Search */}
      <div className="mb-4 flex items-center gap-4">
        <div className="bg-muted/40 flex flex-1 gap-1 overflow-x-auto rounded-xl p-1">
          <button
            onClick={() => setActiveCategory(null)}
            className={cn(
              'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all',
              activeCategory === null
                ? 'bg-primary/10 text-primary font-bold shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeCategory === cat.id
                  ? 'bg-primary/10 text-primary font-bold shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Action Buttons for Active Category */}
        {activeCategory !== null && (
          <div className="border-border flex shrink-0 items-center justify-center gap-2 border-r pr-4">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl hover:bg-blue-50 hover:text-blue-600"
              onClick={() => {
                const cat = categories.find((c) => c.id === activeCategory)
                if (cat) openCategoryModal(cat)
              }}
              title="Edit Category"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-red-100 text-red-600 h-10 w-10 rounded-xl hover:bg-red-50 hover:text-red-700"
              onClick={() => deleteCategory(activeCategory)}
              title="Delete Category"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="relative w-64 shrink-0">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl pl-9"
          />
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="border-primary h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Package className="text-muted-foreground h-16 w-16" />
            <p className="text-muted-foreground text-sm">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {filtered.map((product) => (
              <Card key={product.id} className="group overflow-hidden border transition-all hover:shadow-md">
                <div className="bg-muted relative aspect-square overflow-hidden">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="text-muted-foreground h-12 w-12" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 flex gap-1">
                    <button
                      onClick={() => openProductModal(product)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-md transition-colors hover:bg-blue-50"
                    >
                      <Pencil className="h-3.5 w-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-md transition-colors hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                    </button>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="text-foreground truncate text-sm font-semibold">{product.name}</p>
                  {product.category && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{product.category}</p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-primary text-sm font-bold">{formatRupiah(product.price)}</span>
                    {product.cogs > 0 && (
                      <span className="text-muted-foreground text-xs">COGS: {formatRupiah(product.cogs)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Product Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowProductModal(false)}>
          <div className="bg-card w-full max-w-md rounded-2xl border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-bold">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setShowProductModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Name</label>
                <Input
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Product name"
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">Price</label>
                  <Input
                    type="number"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                    placeholder="0"
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">COGS</label>
                  <Input
                    type="number"
                    value={productForm.cogs}
                    onChange={(e) => setProductForm({ ...productForm, cogs: e.target.value })}
                    placeholder="0"
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Category</label>
                <select
                  value={productForm.category_id}
                  onChange={(e) => setProductForm({ ...productForm, category_id: e.target.value })}
                  className="border-input bg-background w-full rounded-xl border px-3 py-2 text-sm"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Image URL</label>
                <Input
                  value={productForm.image}
                  onChange={(e) => setProductForm({ ...productForm, image: e.target.value })}
                  placeholder="https://..."
                  className="rounded-xl"
                />
              </div>
              <Button
                className="w-full rounded-xl"
                onClick={saveProduct}
                disabled={!productForm.name || !productForm.price}
              >
                <Save className="mr-2 h-4 w-4" />
                {editingProduct ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-bold">
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Category Name</label>
                <Input
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  placeholder="e.g. Beverages"
                  className="rounded-xl"
                />
              </div>
              <Button
                className="w-full rounded-xl"
                onClick={saveCategory}
                disabled={!categoryName.trim()}
              >
                <Save className="mr-2 h-4 w-4" />
                {editingCategory ? 'Update Category' : 'Add Category'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
