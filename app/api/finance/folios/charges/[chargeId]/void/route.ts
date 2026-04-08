import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

export async function POST(req: Request, { params }: { params: Promise<{ chargeId: string }> }) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth
  const { chargeId } = await params

  try {
    const body = await req.json()
    const reason = String(body.reason || '').trim()

    if (!reason) {
      return NextResponse.json({ error: 'reason is required' }, { status: 400 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const chargeRes = await client.query(
        `
          SELECT
            fc.*,
            f.unit_id,
            je.transaction_date
          FROM folio_charges fc
          JOIN folios f ON f.id = fc.folio_id
          LEFT JOIN journal_entries je ON je.id = fc.journal_entry_id
          WHERE fc.id = $1
            AND fc.deleted_at IS NULL
          LIMIT 1
        `,
        [chargeId],
      )

      const charge = chargeRes.rows[0]
      if (!charge) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Charge not found' }, { status: 404 })
      }
      if (charge.status !== 'ACTIVE') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Charge already voided' }, { status: 409 })
      }
      if (!canAccessUnit(auth, Number(charge.unit_id))) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
      }

      const reversalJeRes = await client.query(
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
          VALUES ($1, $2, 'REVERSAL', 'POSTED', 'FOLIO_VOID', $3::date, $4, $5, $5)
          RETURNING id
        `,
        [
          charge.unit_id,
          `Void folio charge ${charge.id}: ${reason}`,
          charge.transaction_date || new Date().toISOString().slice(0, 10),
          charge.folio_id,
          auth.userId,
        ],
      )

      const reversalJeId = reversalJeRes.rows[0].id

      const originalLinesRes = await client.query(
        'SELECT account_code, debit, kredit, description FROM journal_lines WHERE journal_entry_id = $1',
        [charge.journal_entry_id],
      )

      for (const line of originalLinesRes.rows) {
        await client.query(
          `
            INSERT INTO journal_lines (
              journal_entry_id,
              account_code,
              debit,
              kredit,
              description,
              created_by,
              updated_by
            )
            VALUES ($1, $2, $3, $4, $5, $6, $6)
          `,
          [reversalJeId, line.account_code, Number(line.kredit), Number(line.debit), line.description, auth.userId],
        )
      }

      const reversalChargeRes = await client.query(
        `
          INSERT INTO folio_charges (
            folio_id,
            charge_date,
            charge_type,
            description,
            amount,
            amount_base,
            status,
            reason,
            journal_entry_id,
            reversed_charge_id,
            created_by,
            updated_by
          )
          VALUES (
            $1,
            CURRENT_DATE,
            'REVERSAL',
            $2,
            $3,
            $3,
            'VOID_REVERSAL',
            $4,
            $5,
            $6,
            $7,
            $7
          )
          RETURNING id
        `,
        [charge.folio_id, `Reversal for charge ${charge.id}`, -Math.abs(Number(charge.amount)), reason, reversalJeId, charge.id, auth.userId],
      )

      await client.query(
        `
          UPDATE folio_charges
          SET status = 'VOIDED',
              reason = $2,
              updated_at = CURRENT_TIMESTAMP,
              updated_by = $3
          WHERE id = $1
        `,
        [charge.id, reason, auth.userId],
      )

      await client.query('COMMIT')

      await writeAuditLog(pool, {
        userId: auth.userId,
        action: 'FOLIO_CHARGE_VOID',
        resource: 'folio_charges',
        resourceId: charge.id,
        metadata: { reversal_charge_id: reversalChargeRes.rows[0].id, reason },
      })

      return NextResponse.json({ success: true, reversal_charge_id: reversalChargeRes.rows[0].id })
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
