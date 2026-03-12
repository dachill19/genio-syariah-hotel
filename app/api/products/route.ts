import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

const UPLOAD_DIR = join(process.cwd(), 'public', 'products')

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')

  try {
    const pool = await getDb()
    let query = `
      SELECT p.*, c.name as category, u.type as unit_type 
      FROM products p
      JOIN units u ON p.unit_id = u.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
    `
    const params: any[] = []

    if (unitId) {
      query += ' AND p.unit_id = $1'
      params.push(unitId)
    }

    const res = await pool.query(query, params)
    const products = res.rows

    const formattedProducts = products.map((p: any) => ({
      ...p,
      variants: p.variants ? JSON.parse(p.variants) : [],
      custom_id: `${p.unit_type}_${p.id}`,
    }))

    return NextResponse.json(formattedProducts)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const name = formData.get('name') as string
    const price = formData.get('price') as string
    const cogs = formData.get('cogs') as string
    const category_id = formData.get('category_id') as string
    const unit_id = formData.get('unit_id') as string
    const file = formData.get('image') as File | null

    if (!name || !price || !unit_id) {
      return NextResponse.json({ error: 'name, price, and unit_id are required' }, { status: 400 })
    }

    let imagePath = null

    if (file) {
      if (!existsSync(UPLOAD_DIR)) {
        await mkdir(UPLOAD_DIR, { recursive: true })
      }

      const buffer = await file.arrayBuffer()
      const filename = `${Date.now()}-${file.name}`
      const filepath = join(UPLOAD_DIR, filename)
      
      await writeFile(filepath, Buffer.from(buffer))
      imagePath = `/products/${filename}`
    }

    const pool = await getDb()
    const res = await pool.query(
      `INSERT INTO products (name, price, cogs, category_id, unit_id, image, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, parseInt(price), parseInt(cogs) || 0, category_id ? parseInt(category_id) : null, parseInt(unit_id), imagePath, null],
    )

    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
