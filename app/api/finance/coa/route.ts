import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit-log'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_HEAD'])
  if (!authCheck.ok) return authCheck.response

  try {
    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT
          c.code,
          c.account_name,
          c.account_type,
          c.normal_balance,
          c.parent_code,
          c.level,
          c.is_active,
          (
            SELECT COUNT(*)::int
            FROM coa child
            WHERE child.parent_code = c.code
              AND child.deleted_at IS NULL
          ) AS children_count
        FROM coa c
        WHERE c.deleted_at IS NULL
        ORDER BY c.account_type ASC, c.code ASC
      `,
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const body = await req.json()
    const code = String(body.code || '').trim()
    const account_name = String(body.account_name || '').trim()
    const account_type = String(body.account_type || '').trim()
    const normal_balance = String(body.normal_balance || '').trim()
    const parent_code = body.parent_code ? String(body.parent_code).trim() : null

    if (!code || !account_name || !account_type || !normal_balance) {
      return NextResponse.json({ error: 'code, account_name, account_type, and normal_balance are required' }, { status: 400 })
    }

    const pool = await getDb()

    let level = 1
    if (parent_code) {
      const parentRes = await pool.query('SELECT level FROM coa WHERE code = $1 AND deleted_at IS NULL LIMIT 1', [parent_code])
      const parent = parentRes.rows[0]
      if (!parent) {
        return NextResponse.json({ error: 'Parent account not found' }, { status: 404 })
      }
      level = Number(parent.level || 0) + 1
    }

    const result = await pool.query(
      `
        INSERT INTO coa (
          code,
          account_name,
          account_type,
          normal_balance,
          parent_code,
          level,
          is_active,
          created_by,
          updated_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)
        RETURNING *
      `,
      [code, account_name, account_type, normal_balance, parent_code, level, auth.userId],
    )

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'COA_CREATE',
      resource: 'coa',
      resourceId: code,
      metadata: { account_name, account_type, normal_balance, parent_code },
    })

    return NextResponse.json(result.rows[0], { status: 201 })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
