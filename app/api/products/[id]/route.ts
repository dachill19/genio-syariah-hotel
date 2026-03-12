import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, price, cogs, category_id, image, variants } = body

    const pool = await getDb()

    const updates: string[] = []
    const values: any[] = []

    if (name !== undefined) { values.push(name); updates.push(`name = $${values.length}`) }
    if (price !== undefined) { values.push(price); updates.push(`price = $${values.length}`) }
    if (cogs !== undefined) { values.push(cogs); updates.push(`cogs = $${values.length}`) }
    if (category_id !== undefined) { values.push(category_id || null); updates.push(`category_id = $${values.length}`) }
    if (image !== undefined) { values.push(image || null); updates.push(`image = $${values.length}`) }
    if (variants !== undefined) { values.push(variants ? JSON.stringify(variants) : null); updates.push(`variants = $${values.length}`) }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    values.push(id)
    const res = await pool.query(
      `UPDATE products SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
