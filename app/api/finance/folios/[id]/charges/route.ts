import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'
import { resolvePostingAccounts } from '@/lib/posting-account-mapping'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'AUDITOR', 'DEPARTMENT_HEAD'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth
  const { id } = await params

  try {
    const pool = await getDb()
    const folioRes = await pool.query('SELECT unit_id FROM folios WHERE id = $1 AND deleted_at IS NULL', [id])
    const folio = folioRes.rows[0]
    if (!folio) {
      return NextResponse.json({ error: 'Folio not found' }, { status: 404 })
    }
    if (!canAccessUnit(auth, Number(folio.unit_id))) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const result = await pool.query(
      `
        SELECT *
        FROM folio_charges
        WHERE folio_id = $1
          AND deleted_at IS NULL
        ORDER BY charge_date DESC, created_at DESC
      `,
      [id],
    )

    return NextResponse.json(result.rows)
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth
  const { id } = await params

  try {
    const body = await req.json()
    const charge_type = String(body.charge_type || '').trim().toUpperCase()
    const description = body.description ? String(body.description).trim() : null
    const charge_date = body.charge_date ? String(body.charge_date).trim() : new Date().toISOString().slice(0, 10)
    const amount = Math.round(Number(body.amount))

    if (!charge_type || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'charge_type and amount are required' }, { status: 400 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const folioRes = await client.query(
        'SELECT id, unit_id, status FROM folios WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
        [id],
      )
      const folio = folioRes.rows[0]
      if (!folio) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Folio not found' }, { status: 404 })
      }
      if (folio.status !== 'OPEN') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Folio is not open' }, { status: 409 })
      }
      if (!canAccessUnit(auth, Number(folio.unit_id))) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
      }

      const postingAccounts = await resolvePostingAccounts(client, 'FOLIO', 'CHARGE_POST', charge_type)

      const journalRes = await client.query(
        `
          INSERT INTO journal_entries (
            unit_id,
            description,
            journal_type,
            posting_status,
            source_module,
            transaction_date,
            reference_no,
            created_by,
            updated_by
          )
          VALUES ($1, $2, 'GENERAL', 'POSTED', 'FOLIO', $3::date, $4, $5, $5)
          RETURNING id
        `,
        [
          folio.unit_id,
          `Folio charge ${charge_type}`,
          charge_date,
          id,
          auth.userId,
        ],
      )

      const journalId = journalRes.rows[0].id

      await client.query(
        `
          INSERT INTO journal_lines (journal_entry_id, account_code, debit, kredit, description, created_by, updated_by)
          VALUES
            ($1, $5, $2, 0, $3, $4, $4),
            ($1, $6, 0, $2, $3, $4, $4)
        `,
        [
          journalId,
          amount,
          description || charge_type,
          auth.userId,
          postingAccounts.debitAccountCode,
          postingAccounts.creditAccountCode,
        ],
      )

      const chargeRes = await client.query(
        `
          INSERT INTO folio_charges (
            folio_id,
            charge_date,
            charge_type,
            description,
            amount,
            amount_base,
            journal_entry_id,
            created_by,
            updated_by
          )
          VALUES ($1, $2::date, $3, $4, $5, $5, $6, $7, $7)
          RETURNING *
        `,
        [id, charge_date, charge_type, description, amount, journalId, auth.userId],
      )

      await client.query('COMMIT')

      await writeAuditLog(pool, {
        userId: auth.userId,
        action: 'FOLIO_CHARGE_POST',
        resource: 'folio_charges',
        resourceId: chargeRes.rows[0].id,
        metadata: { folio_id: id, charge_type, amount },
      })

      return NextResponse.json(chargeRes.rows[0], { status: 201 })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
