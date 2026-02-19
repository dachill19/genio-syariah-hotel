import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')

  try {
    const pool = await getDb()
    let query = `
      SELECT p.*, u.type as unit_type 
      FROM products p
      JOIN units u ON p.unit_id = u.id
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
