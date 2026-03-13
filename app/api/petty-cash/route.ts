import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

const PETTY_CASH_PREFIX = 'PETTY_CASH_SENTINEL'
const ALLOWED_SOURCE_ACCOUNTS = new Set(['1101', '1103'])

const buildSentinelInvoiceNumber = () => {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomStr = Math.floor(1000 + Math.random() * 9000)
  return `INV-ADMIN-${dateStr}-${randomStr}`
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unitId')

  if (!unitId) {
    return NextResponse.json({ error: 'unitId is required' }, { status: 400 })
  }

  try {
    const pool = await getDb()
    const result = await pool.query(
      `
        SELECT
          pc.id,
          pc.unit_id,
          pc.user_id,
          pc.source_account,
          pc.amount,
          pc.description,
          pc.receipt_proof,
          pc.created_at,
          pc.sentinel_order_id,
          pc.journal_entry_id,
          u.username,
          o.invoice_number
        FROM petty_cash_entries pc
        JOIN users u ON u.id = pc.user_id
        JOIN orders o ON o.id = pc.sentinel_order_id
        WHERE pc.unit_id = $1
        ORDER BY pc.created_at DESC
      `,
      [Number(unitId)],
    )

    return NextResponse.json(result.rows)
  } catch (error: any) {
    console.error('Petty cash fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch petty cash entries' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const source_account = String(body.source_account || '')
    const description = String(body.description || '').trim()
    const receipt_proof = body.receipt_proof ? String(body.receipt_proof) : null
    const user_id = String(body.user_id || '')
    const idempotency_key = String(body.idempotency_key || '').trim()
    const unit_id = Number(body.unit_id)
    const roundedAmount = Math.round(Number(body.amount))

    if (!Number.isFinite(unit_id) || unit_id <= 0) {
      return NextResponse.json({ error: 'unit_id is required' }, { status: 400 })
    }
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 })
    }
    if (!idempotency_key) {
      return NextResponse.json({ error: 'idempotency_key is required' }, { status: 400 })
    }
    if (!ALLOWED_SOURCE_ACCOUNTS.has(source_account)) {
      return NextResponse.json({ error: 'source_account must be 1101 or 1103' }, { status: 400 })
    }
    if (!Number.isFinite(roundedAmount) || roundedAmount < 500) {
      return NextResponse.json({ error: 'amount must be at least 500' }, { status: 400 })
    }
    if (description.length < 3) {
      return NextResponse.json({ error: 'description must be at least 3 characters' }, { status: 400 })
    }
    if (receipt_proof && !receipt_proof.startsWith('data:image/')) {
      return NextResponse.json({ error: 'receipt_proof must be an image data URL' }, { status: 400 })
    }
    if (receipt_proof && receipt_proof.length > 2_000_000) {
      return NextResponse.json({ error: 'receipt_proof is too large' }, { status: 400 })
    }

    const pool = await getDb()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const existingRecordRes = await client.query(
        `
          SELECT id, sentinel_order_id, journal_entry_id
          FROM petty_cash_entries
          WHERE idempotency_key = $1
          LIMIT 1
        `,
        [idempotency_key],
      )

      if (existingRecordRes.rowCount && existingRecordRes.rows[0]) {
        await client.query('COMMIT')
        return NextResponse.json({
          success: true,
          duplicate: true,
          petty_cash_id: existingRecordRes.rows[0].id,
          sentinel_order_id: existingRecordRes.rows[0].sentinel_order_id,
          journal_entry_id: existingRecordRes.rows[0].journal_entry_id,
        })
      }

      const userRes = await client.query(
        'SELECT id, username, role, unit_id FROM users WHERE id = $1 LIMIT 1',
        [user_id],
      )
      const user = userRes.rows[0]

      if (!user) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      if (user.role !== 'MANAGER') {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Only managers can record petty cash' }, { status: 403 })
      }
      if (Number(user.unit_id) !== unit_id) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'User is not allowed for this unit' }, { status: 403 })
      }

      const unitRes = await client.query('SELECT id FROM units WHERE id = $1 LIMIT 1', [unit_id])
      if (!unitRes.rowCount) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Unit not found' }, { status: 404 })
      }

      const coaRes = await client.query('SELECT code FROM coa WHERE code = $1 LIMIT 1', [source_account])
      if (!coaRes.rowCount) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Source account not found' }, { status: 400 })
      }

      const sentinelDescription = `${PETTY_CASH_PREFIX} - ${description}`
      const paymentMethod = source_account === '1101' ? 'CASH' : 'CARD'

      const orderRes = await client.query(
        `
          INSERT INTO orders (
            unit_id,
            user_id,
            invoice_number,
            description,
            subtotal,
            tax_amount,
            grand_total,
            payment_method,
            cashier_name,
            payment_status,
            kitchen_status,
            table_number,
            customer_name,
            order_type
          )
          VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8, 'PAID', 'COMPLETED', '', '', 'Take Away')
          RETURNING id
        `,
        [
          unit_id,
          user_id,
          buildSentinelInvoiceNumber(),
          sentinelDescription,
          roundedAmount,
          roundedAmount,
          paymentMethod,
          user.username,
        ],
      )

      const sentinelOrderId = orderRes.rows[0].id

      const journalEntryRes = await client.query(
        `
          INSERT INTO journal_entries (unit_id, order_id, description)
          VALUES ($1, $2, $3)
          RETURNING id
        `,
        [unit_id, sentinelOrderId, `Pengeluaran Kas Kecil: ${description}`],
      )

      const journalEntryId = journalEntryRes.rows[0].id

      await client.query(
        `
          INSERT INTO journal_lines (journal_entry_id, account_code, debit, kredit)
          VALUES ($1, '5201', $2, 0), ($1, $3, 0, $2)
        `,
        [journalEntryId, roundedAmount, source_account],
      )

      const balanceRes = await client.query(
        `
          SELECT COALESCE(SUM(debit), 0) as total_debit, COALESCE(SUM(kredit), 0) as total_credit
          FROM journal_lines
          WHERE journal_entry_id = $1
        `,
        [journalEntryId],
      )

      const totalDebit = Number(balanceRes.rows[0]?.total_debit || 0)
      const totalCredit = Number(balanceRes.rows[0]?.total_credit || 0)

      if (totalDebit !== totalCredit) {
        throw new Error('Journal entry is not balanced')
      }

      const pettyCashRes = await client.query(
        `
          INSERT INTO petty_cash_entries (
            unit_id,
            user_id,
            source_account,
            amount,
            description,
            receipt_proof,
            idempotency_key,
            sentinel_order_id,
            journal_entry_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING id
        `,
        [
          unit_id,
          user_id,
          source_account,
          roundedAmount,
          description,
          receipt_proof,
          idempotency_key,
          sentinelOrderId,
          journalEntryId,
        ],
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        petty_cash_id: pettyCashRes.rows[0].id,
        sentinel_order_id: sentinelOrderId,
        journal_entry_id: journalEntryId,
      })
    } catch (error: any) {
      await client.query('ROLLBACK')
      console.error('Petty cash create error:', error)
      return NextResponse.json({ error: 'Failed to record petty cash' }, { status: 500 })
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Petty cash request error:', error)
    return NextResponse.json({ error: 'Invalid petty cash request' }, { status: 400 })
  }
}