import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const { name } = await req.json()

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const pool = await getDb()
    const res = await pool.query(
      'UPDATE categories SET name = $1 WHERE id = $2 RETURNING *',
      [name, id],
    )

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json(res.rows[0])
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category name already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pool = await getDb()

    const res = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [id])

    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Category deleted' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
