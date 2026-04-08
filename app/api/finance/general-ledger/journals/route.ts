import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'

type JournalLineInput = {
  account_code: string
  debit: number
  kredit: number
  description: string | null
}

export async function POST(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const body = await req.json()
    const unit_id = Number(body.unit_id)
    const description = String(body.description || '').trim()
    const transaction_date = String(body.transaction_date || '').trim()
    const lines = Array.isArray(body.lines) ? body.lines : []

    if (!Number.isFinite(unit_id) || unit_id <= 0 || !description || !transaction_date || lines.length < 2) {
      return NextResponse.json({ error: 'unit_id, description, transaction_date, and at least 2 lines are required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const normalizedLines: JournalLineInput[] = lines.map((line: unknown) => {
      const row = line as Record<string, unknown>
      return {
        account_code: String(row.account_code || '').trim(),
        debit: Math.round(Number(row.debit || 0)),
        kredit: Math.round(Number(row.kredit || 0)),
        description: row.description ? String(row.description) : null,
      }
    })

    if (normalizedLines.some((line: JournalLineInput) => !line.account_code || line.debit < 0 || line.kredit < 0 || (line.debit === 0 && line.kredit === 0))) {
      return NextResponse.json({ error: 'Invalid journal lines' }, { status: 400 })
    }

    const totalDebit = normalizedLines.reduce((sum: number, line: JournalLineInput) => sum + line.debit, 0)
    const totalCredit = normalizedLines.reduce((sum: number, line: JournalLineInput) => sum + line.kredit, 0)

    if (totalDebit !== totalCredit) {
      return NextResponse.json({ error: 'Journal not balanced' }, { status: 400 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const periodRes = await client.query(
        `
          SELECT id, status
          FROM accounting_periods
          WHERE starts_on <= $1::date
            AND ends_on >= $1::date
          ORDER BY starts_on DESC
          LIMIT 1
        `,
        [transaction_date],
      )

      const period = periodRes.rows[0]
      if (!period) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Accounting period not found for transaction_date' }, { status: 400 })
      }
      if (period.status !== 'OPEN') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Accounting period is not OPEN' }, { status: 409 })
      }

      const journalRes = await client.query(
        `
          INSERT INTO journal_entries (
            unit_id,
            period_id,
            description,
            journal_type,
            posting_status,
            source_module,
            transaction_date,
            created_by,
            updated_by
          )
          VALUES ($1, $2, $3, 'GENERAL', 'POSTED', 'MANUAL_GL', $4::date, $5, $5)
          RETURNING id
        `,
        [unit_id, period.id, description, transaction_date, auth.userId],
      )

      const journalId = journalRes.rows[0].id

      for (const line of normalizedLines) {
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
          [journalId, line.account_code, line.debit, line.kredit, line.description, auth.userId],
        )
      }

      await client.query('COMMIT')

      await writeAuditLog(pool, {
        userId: auth.userId,
        action: 'GL_JOURNAL_CREATE',
        resource: 'journal_entries',
        resourceId: journalId,
        metadata: { unit_id, transaction_date, description, line_count: normalizedLines.length, total_debit: totalDebit, total_credit: totalCredit },
      })

      return NextResponse.json({ success: true, id: journalId }, { status: 201 })
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
