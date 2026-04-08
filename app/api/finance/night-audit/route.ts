import { NextResponse } from 'next/server'
import { canAccessUnit, requireAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit-log'
import { resolvePostingAccounts } from '@/lib/posting-account-mapping'

export async function GET(req: Request) {
  const authCheck = requireAuth(req, ['SUPER_ADMIN', 'FINANCE_MANAGER', 'RECONCILER', 'GENERAL_MANAGER', 'AUDITOR'])
  if (!authCheck.ok) return authCheck.response

  const auth = authCheck.auth

  try {
    const { searchParams } = new URL(req.url)
    const unitId = Number(searchParams.get('unitId'))

    if (!Number.isFinite(unitId) || unitId <= 0) {
      return NextResponse.json({ error: 'unitId is required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unitId)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const stateRes = await pool.query(
      `
        SELECT unit_id, business_date, last_night_audit_at
        FROM unit_business_dates
        WHERE unit_id = $1
        LIMIT 1
      `,
      [unitId],
    )

    const latestRes = await pool.query(
      `
        SELECT business_date, total_room_charges, total_folios
        FROM night_audits
        WHERE unit_id = $1
        ORDER BY business_date DESC
        LIMIT 1
      `,
      [unitId],
    )

    return NextResponse.json({
      business_date: stateRes.rows[0]?.business_date || null,
      last_night_audit_at: stateRes.rows[0]?.last_night_audit_at || null,
      latest_audit: latestRes.rows[0] || null,
    })
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
    const unit_id = Number(body.unit_id)

    if (!Number.isFinite(unit_id) || unit_id <= 0) {
      return NextResponse.json({ error: 'unit_id is required' }, { status: 400 })
    }
    if (!canAccessUnit(auth, unit_id)) {
      return NextResponse.json({ error: 'Forbidden for this unit' }, { status: 403 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const businessRes = await client.query(
        'SELECT business_date FROM unit_business_dates WHERE unit_id = $1 LIMIT 1',
        [unit_id],
      )
      const currentBusinessDate = businessRes.rows[0]?.business_date
      if (!currentBusinessDate) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Business date not initialized for this unit' }, { status: 404 })
      }

      const existingAuditRes = await client.query(
        'SELECT id FROM night_audits WHERE unit_id = $1 AND business_date = $2::date LIMIT 1',
        [unit_id, currentBusinessDate],
      )
      if (existingAuditRes.rowCount) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Night audit already executed for this business date' }, { status: 409 })
      }

      const foliosRes = await client.query(
        `
          SELECT id, room_rate
          FROM folios
          WHERE unit_id = $1
            AND status = 'OPEN'
            AND deleted_at IS NULL
            AND check_in_date <= $2::date
            AND check_out_date > $2::date
        `,
        [unit_id, currentBusinessDate],
      )

      const postingAccounts = await resolvePostingAccounts(client, 'NIGHT_AUDIT', 'ROOM_RATE', '*')

      let totalRoomCharges = 0
      let totalFolios = 0

      for (const folio of foliosRes.rows) {
        const postedRes = await client.query(
          'SELECT id FROM folio_daily_postings WHERE folio_id = $1 AND business_date = $2::date LIMIT 1',
          [folio.id, currentBusinessDate],
        )
        if (postedRes.rowCount) {
          continue
        }

        const amount = Math.round(Number(folio.room_rate || 0))
        if (amount <= 0) {
          continue
        }

        const journalRes = await client.query(
          `
            INSERT INTO journal_entries (
              unit_id,
              description,
              journal_type,
              posting_status,
              source_module,
              reference_no,
              transaction_date,
              created_by,
              updated_by
            )
            VALUES ($1, $2, 'GENERAL', 'POSTED', 'NIGHT_AUDIT', $3, $4::date, $5, $5)
            RETURNING id
          `,
          [unit_id, 'Night audit room posting', folio.id, currentBusinessDate, auth.userId],
        )

        const journalId = journalRes.rows[0].id

        await client.query(
          `
            INSERT INTO journal_lines (journal_entry_id, account_code, debit, kredit, description, created_by, updated_by)
            VALUES
              ($1, $2, $3, 0, 'Night audit room posting', $4, $4),
              ($1, $5, 0, $3, 'Night audit room posting', $4, $4)
          `,
          [journalId, postingAccounts.debitAccountCode, amount, auth.userId, postingAccounts.creditAccountCode],
        )

        await client.query(
          `
            INSERT INTO folio_charges (
              folio_id,
              charge_date,
              charge_type,
              description,
              amount,
              amount_base,
              status,
              journal_entry_id,
              created_by,
              updated_by
            )
            VALUES ($1, $2::date, 'ROOM_RATE', 'Night audit room posting', $3, $3, 'ACTIVE', $4, $5, $5)
          `,
          [folio.id, currentBusinessDate, amount, journalId, auth.userId],
        )

        await client.query(
          'INSERT INTO folio_daily_postings (folio_id, business_date) VALUES ($1, $2::date)',
          [folio.id, currentBusinessDate],
        )

        totalRoomCharges += amount
        totalFolios += 1
      }

      const auditRes = await client.query(
        `
          INSERT INTO night_audits (
            unit_id,
            business_date,
            run_by,
            total_room_charges,
            total_folios,
            report
          )
          VALUES ($1, $2::date, $3, $4, $5, $6::jsonb)
          RETURNING id
        `,
        [
          unit_id,
          currentBusinessDate,
          auth.userId,
          totalRoomCharges,
          totalFolios,
          JSON.stringify({ total_room_charges: totalRoomCharges, total_folios: totalFolios }),
        ],
      )

      await client.query(
        `
          UPDATE unit_business_dates
          SET business_date = (business_date + INTERVAL '1 day')::date,
              last_night_audit_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE unit_id = $1
        `,
        [unit_id],
      )

      await client.query('COMMIT')

      await writeAuditLog(pool, {
        userId: auth.userId,
        action: 'NIGHT_AUDIT_RUN',
        resource: 'night_audits',
        resourceId: auditRes.rows[0].id,
        metadata: { unit_id, business_date_closed: currentBusinessDate, total_room_charges: totalRoomCharges, total_folios: totalFolios },
      })

      return NextResponse.json({
        success: true,
        business_date_closed: currentBusinessDate,
        total_room_charges: totalRoomCharges,
        total_folios: totalFolios,
      })
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
