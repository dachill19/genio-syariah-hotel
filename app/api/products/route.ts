import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

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
    const body = await req.json()
    const { name, price, cogs, category_id, unit_id, image, variants } = body

    if (!name || !price || !unit_id) {
      return NextResponse.json({ error: 'name, price, and unit_id are required' }, { status: 400 })
    }

    const pool = await getDb()
    const res = await pool.query(
      `INSERT INTO products (name, price, cogs, category_id, unit_id, image, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, price, cogs || 0, category_id || null, unit_id, image || null, variants ? JSON.stringify(variants) : null],
    )

    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
