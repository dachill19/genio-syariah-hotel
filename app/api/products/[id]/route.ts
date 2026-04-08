import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { requireAuth } from '@/lib/auth'

const UPLOAD_DIR = join(process.cwd(), 'public', 'products')

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'MANAGER'])
  if (!authCheck.ok) return authCheck.response

  try {
    const { id } = await params
    
    const contentType = req.headers.get('content-type') || ''
    const updates: string[] = []
    const values: unknown[] = []

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const name = formData.get('name') as string
      const price = formData.get('price') as string
      const cogs = formData.get('cogs') as string
      const category_id = formData.get('category_id') as string
      const variants = formData.get('variants') as string
      const file = formData.get('image') as File | null

      if (name !== undefined && name !== '') { values.push(name); updates.push(`name = $${values.length}`) }
      if (price !== undefined && price !== '') { values.push(parseInt(price)); updates.push(`price = $${values.length}`) }
      if (cogs !== undefined && cogs !== '') { values.push(parseInt(cogs)); updates.push(`cogs = $${values.length}`) }
      if (category_id !== undefined) { values.push(category_id ? parseInt(category_id) : null); updates.push(`category_id = $${values.length}`) }
      if (variants !== undefined) { values.push(variants ? JSON.stringify(JSON.parse(variants)) : null); updates.push(`variants = $${values.length}`) }

      if (file) {
        if (!existsSync(UPLOAD_DIR)) {
          await mkdir(UPLOAD_DIR, { recursive: true })
        }

        const buffer = await file.arrayBuffer()
        const filename = `${Date.now()}-${file.name}`
        const filepath = join(UPLOAD_DIR, filename)
        
        await writeFile(filepath, Buffer.from(buffer))
        const imagePath = `/products/${filename}`
        values.push(imagePath)
        updates.push(`image = $${values.length}`)
      }
    } else {
      const body = await req.json()
      const { name, price, cogs, category_id, image, variants } = body

      if (name !== undefined) { values.push(name); updates.push(`name = $${values.length}`) }
      if (price !== undefined) { values.push(price); updates.push(`price = $${values.length}`) }
      if (cogs !== undefined) { values.push(cogs); updates.push(`cogs = $${values.length}`) }
      if (category_id !== undefined) { values.push(category_id || null); updates.push(`category_id = $${values.length}`) }
      if (image !== undefined) { values.push(image || null); updates.push(`image = $${values.length}`) }
      if (variants !== undefined) { values.push(variants ? JSON.stringify(variants) : null); updates.push(`variants = $${values.length}`) }
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(id)
    const pool = await getDb()
    const res = await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: unknown) {
    console.error('Update error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(_req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'MANAGER'])
  if (!authCheck.ok) return authCheck.response

  try {
    const { id } = await params
    const pool = await getDb()

    const res = await pool.query(
      'UPDATE products SET is_active = 0 WHERE id = $1 RETURNING *',
      [id],
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Product deleted' })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
