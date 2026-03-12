'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VariantGroup } from '@/types/pos'
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
  variants: VariantGroup[]
  is_active: number
}

interface ProductFormState {
  name: string
  price: string
  cogs: string
  category_id: string
  image: File | null
  imagePreview: string
  variants: VariantGroup[]
}

const emptyProductForm = (): ProductFormState => ({
  name: '',
  price: '',
  cogs: '',
  category_id: '',
  image: null,
  imagePreview: '',
  variants: [],
})

export function MenuManager({ unitId }: MenuManagerProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [isDeletingProduct, setIsDeletingProduct] = useState(false)

  const [showProductModal, setShowProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)

  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [categoryName, setCategoryName] = useState('')

  const [productForm, setProductForm] = useState<ProductFormState>(emptyProductForm)

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
        image: null,
        imagePreview: product.image || '',
        variants: Array.isArray(product.variants) ? product.variants : [],
      })
    } else {
      setEditingProduct(null)
      setProductForm(emptyProductForm())
    }
    setShowProductModal(true)
  }

  const updateVariantGroup = (groupIndex: number, patch: Partial<VariantGroup>) => {
    setProductForm((prev) => ({
      ...prev,
      variants: prev.variants.map((group, index) =>
        index === groupIndex ? { ...group, ...patch } : group,
      ),
    }))
  }

  const addVariantGroup = () => {
    setProductForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { name: '', options: [{ name: '', price: 0 }] }],
    }))
  }

  const removeVariantGroup = (groupIndex: number) => {
    setProductForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, index) => index !== groupIndex),
    }))
  }

  const addVariantOption = (groupIndex: number) => {
    setProductForm((prev) => ({
      ...prev,
      variants: prev.variants.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              options: [...group.options, { name: '', price: 0 }],
            }
          : group,
      ),
    }))
  }

  const updateVariantOption = (
    groupIndex: number,
    optionIndex: number,
    field: 'name' | 'price',
    value: string,
  ) => {
    setProductForm((prev) => ({
      ...prev,
      variants: prev.variants.map((group, currentGroupIndex) =>
        currentGroupIndex === groupIndex
          ? {
              ...group,
              options: group.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex
                  ? {
                      ...option,
                      [field]: field === 'price' ? Number(value || 0) : value,
                    }
                  : option,
              ),
            }
          : group,
      ),
    }))
  }

  const removeVariantOption = (groupIndex: number, optionIndex: number) => {
    setProductForm((prev) => ({
      ...prev,
      variants: prev.variants.map((group, index) =>
        index === groupIndex
          ? {
              ...group,
              options: group.options.filter((_, currentOptionIndex) => currentOptionIndex !== optionIndex),
            }
          : group,
      ),
    }))
  }

  const normalizeVariants = (variants: VariantGroup[]) => {
    return variants
      .map((group) => ({
        name: group.name.trim(),
        options: group.options
          .map((option) => ({
            name: option.name.trim(),
            price: Number(option.price) || 0,
          }))
          .filter((option) => option.name),
      }))
      .filter((group) => group.name && group.options.length > 0)
  }

  const saveProduct = async () => {
    const variants = normalizeVariants(productForm.variants)
    const formData = new FormData()
    formData.append('name', productForm.name)
    formData.append('price', productForm.price)
    formData.append('cogs', productForm.cogs)
    formData.append('category_id', productForm.category_id)
    formData.append('unit_id', unitId.toString())
    formData.append('variants', JSON.stringify(variants))
    
    if (productForm.image) {
      formData.append('image', productForm.image)
    }

    try {
      if (editingProduct) {
        await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT',
          body: formData,
        })
      } else {
        await fetch('/api/products', {
          method: 'POST',
          body: formData,
        })
      }
      setShowProductModal(false)
      setProductForm(emptyProductForm())
      fetchProducts()
    } catch (e) {
      console.error(e)
    }
  }

  const deleteProduct = async () => {
    if (!productToDelete) return
    setIsDeletingProduct(true)
    try {
      await fetch(`/api/products/${productToDelete.id}`, { method: 'DELETE' })
      setProductToDelete(null)
      fetchProducts()
    } catch (e) {
      console.error(e)
    } finally {
      setIsDeletingProduct(false)
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
                      onClick={() => setProductToDelete(product)}
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

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowProductModal(false)}>
          <div className="bg-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-foreground text-lg font-bold">
                {editingProduct ? 'Edit Product' : 'Add Product'}
              </h2>
              <button onClick={() => setShowProductModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
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
                </div>
                <div>
                  <label className="text-foreground mb-1 block text-sm font-medium">Product Image</label>
                  <div className="flex flex-col gap-3">
                    {productForm.imagePreview && (
                      <div className="bg-muted relative aspect-square overflow-hidden rounded-xl">
                        <img
                          src={productForm.imagePreview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          const reader = new FileReader()
                          reader.onloadend = () => {
                            setProductForm({
                              ...productForm,
                              image: file,
                              imagePreview: reader.result as string,
                            })
                          }
                          reader.readAsDataURL(file)
                        }
                      }}
                      className="border-input bg-background w-full cursor-pointer rounded-xl border px-3 py-2 text-sm file:mr-4 file:border-0 file:bg-primary/10 file:px-4 file:py-1.5 file:text-sm file:font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-foreground text-base font-semibold">Variants</h3>
                    <p className="text-muted-foreground text-sm">Tambahkan pilihan seperti level pedas, es, gula, atau ukuran.</p>
                  </div>
                  <Button type="button" variant="outline" className="rounded-xl" onClick={addVariantGroup}>
                    <Plus className="h-4 w-4" />
                    Add Variant Group
                  </Button>
                </div>

                {productForm.variants.length === 0 ? (
                  <div className="text-muted-foreground rounded-xl border border-dashed px-4 py-6 text-center text-sm">
                    Belum ada varian. Product akan langsung masuk cart tanpa pilihan tambahan.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {productForm.variants.map((group, groupIndex) => (
                      <div key={`${groupIndex}-${group.name}`} className="space-y-4 rounded-2xl border bg-muted/20 p-4">
                        <div className="flex items-center gap-3">
                          <Input
                            value={group.name}
                            onChange={(e) => updateVariantGroup(groupIndex, { name: e.target.value })}
                            placeholder="Nama group, misalnya Level Pedas"
                            className="rounded-xl"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => removeVariantGroup(groupIndex)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {group.options.map((option, optionIndex) => (
                            <div key={`${groupIndex}-${optionIndex}`} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px_44px]">
                              <Input
                                value={option.name}
                                onChange={(e) => updateVariantOption(groupIndex, optionIndex, 'name', e.target.value)}
                                placeholder="Nama opsi, misalnya Pedas"
                                className="rounded-xl"
                              />
                              <Input
                                type="number"
                                value={option.price}
                                onChange={(e) => updateVariantOption(groupIndex, optionIndex, 'price', e.target.value)}
                                placeholder="Harga tambahan"
                                className="rounded-xl"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => removeVariantOption(groupIndex, optionIndex)}
                                disabled={group.options.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}

                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-xl"
                            onClick={() => addVariantOption(groupIndex)}
                          >
                            <Plus className="h-4 w-4" />
                            Add Option
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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

      <Dialog open={Boolean(productToDelete)} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <DialogContent className="max-w-sm gap-0 overflow-hidden border-0 p-0 shadow-2xl">
          <DialogHeader className="px-5 pt-5 pb-4">
            <DialogTitle className="text-xl font-bold">Konfirmasi Hapus Produk</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6">
              {productToDelete
                ? `${productToDelete.name} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-border bg-muted/30 border-t px-5 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setProductToDelete(null)}
              disabled={isDeletingProduct}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              onClick={deleteProduct}
              disabled={isDeletingProduct}
            >
              {isDeletingProduct ? 'Menghapus...' : 'Ya, Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
