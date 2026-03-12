import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')

  try {
    const pool = await getDb()
    let query = 'SELECT * FROM categories'
    const params: any[] = []

    if (unitId) {
      query += ' WHERE unit_id = $1'
      params.push(unitId)
    }

    query += ' ORDER BY name ASC'

    const res = await pool.query(query, params)
    return NextResponse.json(res.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { name, unit_id } = body

    if (!name || !unit_id) {
      return NextResponse.json({ error: 'name and unit_id are required' }, { status: 400 })
    }

    const pool = await getDb()
    const res = await pool.query(
      'INSERT INTO categories (name, unit_id) VALUES ($1, $2) RETURNING *',
      [name, unit_id],
    )

    return NextResponse.json(res.rows[0], { status: 201 })
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Category already exists for this unit' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
