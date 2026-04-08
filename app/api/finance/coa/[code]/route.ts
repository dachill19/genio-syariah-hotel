import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { writeAuditLog } from '@/lib/audit-log'

export async function PUT(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { code } = await params
    const body = await req.json()
    const updates: string[] = []
    const values: unknown[] = []

    if (body.account_name !== undefined) {
      values.push(String(body.account_name).trim())
      updates.push(`account_name = $${values.length}`)
    }
    if (body.normal_balance !== undefined) {
      values.push(String(body.normal_balance).trim())
      updates.push(`normal_balance = $${values.length}`)
    }
    if (body.is_active !== undefined) {
      values.push(Boolean(body.is_active))
      updates.push(`is_active = $${values.length}`)
    }
    if (body.exclude_from_occupancy !== undefined) {
      values.push(Boolean(body.exclude_from_occupancy))
      updates.push(`exclude_from_occupancy = $${values.length}`)
    }

    if (!updates.length) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    values.push(auth.userId)
    updates.push(`updated_by = $${values.length}`)
    updates.push('updated_at = CURRENT_TIMESTAMP')

    values.push(code)

    const pool = await getDb()
    const result = await pool.query(
      `
        UPDATE coa
        SET ${updates.join(', ')}
        WHERE code = $${values.length} AND deleted_at IS NULL
        RETURNING *
      `,
      values,
    )

    if (!result.rowCount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'COA_UPDATE',
      resource: 'coa',
      resourceId: code,
      metadata: body,
    })

    return NextResponse.json(result.rows[0])
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { code } = await params
    const pool = await getDb()

    const usageRes = await pool.query('SELECT 1 FROM journal_lines WHERE account_code = $1 LIMIT 1', [code])
    if (usageRes.rowCount) {
      return NextResponse.json({ error: 'Cannot delete account with transactions' }, { status: 409 })
    }

    const childRes = await pool.query('SELECT 1 FROM coa WHERE parent_code = $1 AND deleted_at IS NULL LIMIT 1', [code])
    if (childRes.rowCount) {
      return NextResponse.json({ error: 'Cannot delete account with child accounts' }, { status: 409 })
    }

    const result = await pool.query(
      `
        UPDATE coa
        SET deleted_at = CURRENT_TIMESTAMP,
            is_active = false,
            updated_at = CURRENT_TIMESTAMP,
            updated_by = $2
        WHERE code = $1 AND deleted_at IS NULL
        RETURNING code
      `,
      [code, auth.userId],
    )

    if (!result.rowCount) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    await writeAuditLog(pool, {
      userId: auth.userId,
      action: 'COA_DELETE',
      resource: 'coa',
      resourceId: code,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
