/* eslint-disable no-console */
const { Client } = require('pg')
const readline = require('readline')

function env(name, fallback) {
  return process.env[name] || fallback
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}

function ymd(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysFromNow(offset, hour = 9, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function createJournal(client, payload) {
  const periodRes = await client.query(
    `
      SELECT id
      FROM accounting_periods
      WHERE starts_on <= $1::date
        AND ends_on >= $1::date
      ORDER BY starts_on DESC
      LIMIT 1
    `,
    [payload.transactionDate],
  )
  const periodId = periodRes.rows[0]?.id || null

  const entryRes = await client.query(
    `
      INSERT INTO journal_entries (
        unit_id,
        period_id,
        description,
        journal_type,
        posting_status,
        source_module,
        source_id,
        transaction_date,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, 'POSTED', $5, $6, $7::date, $8, $8)
      RETURNING id
    `,
    [
      payload.unitId,
      periodId,
      payload.description,
      payload.journalType || 'GENERAL',
      payload.sourceModule || 'DEMO_FINANCE',
      payload.sourceId || null,
      payload.transactionDate,
      payload.actorId || null,
    ],
  )

  const journalId = entryRes.rows[0].id
  let totalDebit = 0
  let totalCredit = 0

  for (const line of payload.lines) {
    const debit = Math.round(Number(line.debit || 0))
    const kredit = Math.round(Number(line.kredit || 0))
    totalDebit += debit
    totalCredit += kredit

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
      [journalId, line.accountCode, debit, kredit, payload.description, payload.actorId || null],
    )
  }

  if (totalDebit !== totalCredit) {
    throw new Error(`Journal not balanced: ${payload.description}`)
  }

  return journalId
}

async function seedUnitFinance(client, unit, actorId, idx) {
  const today = daysFromNow(0, 10, 0)
  const d2 = daysFromNow(-2, 12, 20)
  const d5 = daysFromNow(-5, 11, 0)
  const d12 = daysFromNow(-12, 10, 30)
  const d20 = daysFromNow(-20, 14, 10)

  const unitTag = `${unit.type}-${unit.id}`
  const accountCode = `DEMOFIN-${unitTag}`
  const invoice1 = `DEMO-FIN-${unitTag}-INV-001`
  const invoice2 = `DEMO-FIN-${unitTag}-INV-002`
  const invoice3 = `DEMO-FIN-${unitTag}-INV-003`

  await client.query(
    `
      INSERT INTO bank_accounts (
        unit_id,
        account_name,
        account_number,
        bank_name,
        currency_code,
        account_type,
        gl_account_code,
        opening_balance,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, 'BCA', 'IDR', 'BANK', '1002', $4, $5, $5)
      ON CONFLICT DO NOTHING
    `,
    [unit.id, `[DEMO-FIN] Rekening Operasional ${unit.type}`, `9988${String(unit.id).padStart(3, '0')}`, 25000000, actorId],
  )

  await client.query(
    `
      INSERT INTO exchange_rates (
        rate_date,
        from_currency,
        to_currency,
        rate,
        created_by,
        updated_by
      )
      VALUES ($1::date, 'USD', 'IDR', $2, $3, $3)
      ON CONFLICT (rate_date, from_currency, to_currency)
      DO UPDATE SET
        rate = EXCLUDED.rate,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by,
        deleted_at = NULL
    `,
    [ymd(today), 16250 + idx * 100, actorId],
  )

  const claRes = await client.query(
    `
      INSERT INTO city_ledger_accounts (
        unit_id,
        account_name,
        account_code,
        credit_limit,
        payment_terms_days,
        contact_name,
        is_active,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, 30, 'Finance Demo', true, $5, $5)
      ON CONFLICT (account_code)
      DO UPDATE SET
        account_name = EXCLUDED.account_name,
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by,
        deleted_at = NULL
      RETURNING id
    `,
    [unit.id, `[DEMO-FIN] Corporate ${unit.type}`, accountCode, 15000000, actorId],
  )
  const cityLedgerId = claRes.rows[0].id

  const inv1Res = await client.query(
    `
      INSERT INTO invoices (
        unit_id,
        city_ledger_account_id,
        invoice_number,
        invoice_date,
        due_date,
        subtotal_amount,
        tax_amount,
        total_amount,
        paid_amount,
        status,
        source_module,
        source_id,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4::date, $5::date, 4000000, 400000, 4400000, 0, 'ISSUED', 'DEMO_FINANCE', $6, $7, $7)
      ON CONFLICT (invoice_number)
      DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by,
        deleted_at = NULL
      RETURNING id
    `,
    [unit.id, cityLedgerId, invoice1, ymd(d20), ymd(daysFromNow(-7, 10, 0)), `${unitTag}-1`, actorId],
  )

  await client.query(
    `
      INSERT INTO invoices (
        unit_id,
        city_ledger_account_id,
        invoice_number,
        invoice_date,
        due_date,
        subtotal_amount,
        tax_amount,
        total_amount,
        paid_amount,
        status,
        source_module,
        source_id,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4::date, $5::date, 1800000, 180000, 1980000, 0, 'ISSUED', 'DEMO_FINANCE', $6, $7, $7)
      ON CONFLICT (invoice_number)
      DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by,
        deleted_at = NULL
      RETURNING id
    `,
    [unit.id, cityLedgerId, invoice2, ymd(d12), ymd(daysFromNow(8, 10, 0)), `${unitTag}-2`, actorId],
  )

  const inv3Res = await client.query(
    `
      INSERT INTO invoices (
        unit_id,
        city_ledger_account_id,
        invoice_number,
        invoice_date,
        due_date,
        subtotal_amount,
        tax_amount,
        total_amount,
        paid_amount,
        status,
        source_module,
        source_id,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4::date, $5::date, 3000000, 300000, 3300000, 0, 'ISSUED', 'DEMO_FINANCE', $6, $7, $7)
      ON CONFLICT (invoice_number)
      DO UPDATE SET
        updated_at = CURRENT_TIMESTAMP,
        updated_by = EXCLUDED.updated_by,
        deleted_at = NULL
      RETURNING id
    `,
    [unit.id, cityLedgerId, invoice3, ymd(d5), ymd(daysFromNow(-1, 10, 0)), `${unitTag}-3`, actorId],
  )

  const payment1Res = await client.query(
    `
      INSERT INTO payments (
        unit_id,
        city_ledger_account_id,
        payment_date,
        payment_method,
        amount,
        reference_no,
        notes,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3::date, 'CASH', 2000000, $4, '[DEMO-FIN] Partial settlement', $5, $5)
      RETURNING id
    `,
    [unit.id, cityLedgerId, ymd(d2), `DEMO-FIN-PAY-${unitTag}-001`, actorId],
  )

  const payment2Res = await client.query(
    `
      INSERT INTO payments (
        unit_id,
        city_ledger_account_id,
        payment_date,
        payment_method,
        amount,
        reference_no,
        notes,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3::date, 'TRANSFER', 1200000, $4, '[DEMO-FIN] Transfer settlement', $5, $5)
      RETURNING id
    `,
    [unit.id, cityLedgerId, ymd(today), `DEMO-FIN-PAY-${unitTag}-002`, actorId],
  )

  await client.query(
    `
      INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
      VALUES ($1, $2, 2000000)
      ON CONFLICT (payment_id, invoice_id) DO NOTHING
    `,
    [payment1Res.rows[0].id, inv1Res.rows[0].id],
  )

  await client.query(
    `
      INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount)
      VALUES ($1, $2, 1200000)
      ON CONFLICT (payment_id, invoice_id) DO NOTHING
    `,
    [payment2Res.rows[0].id, inv3Res.rows[0].id],
  )

  await client.query(
    `
      UPDATE invoices
      SET paid_amount = 2000000,
          status = 'OVERDUE',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $2
      WHERE id = $1
    `,
    [inv1Res.rows[0].id, actorId],
  )

  await client.query(
    `
      UPDATE invoices
      SET paid_amount = 1200000,
          status = 'PARTIALLY_PAID',
          updated_at = CURRENT_TIMESTAMP,
          updated_by = $2
      WHERE id = $1
    `,
    [inv3Res.rows[0].id, actorId],
  )

  const pay1Journal = await createJournal(client, {
    unitId: unit.id,
    actorId,
    transactionDate: ymd(d2),
    sourceModule: 'AR',
    sourceId: payment1Res.rows[0].id,
    description: `[DEMO-FIN] AR payment cash ${unit.type}`,
    lines: [
      { accountCode: '1001', debit: 2000000, kredit: 0 },
      { accountCode: '1010', debit: 0, kredit: 2000000 },
    ],
  })

  const pay2Journal = await createJournal(client, {
    unitId: unit.id,
    actorId,
    transactionDate: ymd(today),
    sourceModule: 'AR',
    sourceId: payment2Res.rows[0].id,
    description: `[DEMO-FIN] AR payment transfer ${unit.type}`,
    lines: [
      { accountCode: '1002', debit: 1200000, kredit: 0 },
      { accountCode: '1010', debit: 0, kredit: 1200000 },
    ],
  })

  await client.query('UPDATE payments SET journal_entry_id = $2 WHERE id = $1', [payment1Res.rows[0].id, pay1Journal])
  await client.query('UPDATE payments SET journal_entry_id = $2 WHERE id = $1', [payment2Res.rows[0].id, pay2Journal])

  const guestRes = await client.query(
    `
      INSERT INTO guests (
        unit_id,
        guest_name,
        phone,
        email,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $5)
      RETURNING id
    `,
    [unit.id, `[DEMO-FIN] Guest ${unit.type}`, `081200000${unit.id}`, `demo-fin-${unit.id}@hotel.test`, actorId],
  )

  const folioRes = await client.query(
    `
      INSERT INTO folios (
        unit_id,
        guest_id,
        reservation_no,
        room_number,
        check_in_date,
        check_out_date,
        room_rate,
        status,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5::date, $6::date, 850000, 'OPEN', $7, $7)
      RETURNING id
    `,
    [
      unit.id,
      guestRes.rows[0].id,
      `DEMO-FIN-RES-${unitTag}`,
      String(300 + Number(unit.id)),
      ymd(daysFromNow(-1, 14, 0)),
      ymd(daysFromNow(2, 12, 0)),
      actorId,
    ],
  )

  const folioJournal1 = await createJournal(client, {
    unitId: unit.id,
    actorId,
    transactionDate: ymd(today),
    sourceModule: 'FOLIO',
    sourceId: folioRes.rows[0].id,
    description: `[DEMO-FIN] Folio room charge ${unit.type}`,
    lines: [
      { accountCode: '1010', debit: 850000, kredit: 0 },
      { accountCode: '4001', debit: 0, kredit: 850000 },
    ],
  })

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
      VALUES ($1, $2::date, 'ROOM_RATE', $3, 850000, 850000, 'ACTIVE', $4, $5, $5)
    `,
    [folioRes.rows[0].id, ymd(today), '[DEMO-FIN] Room charge', folioJournal1, actorId],
  )

  const folioJournal2 = await createJournal(client, {
    unitId: unit.id,
    actorId,
    transactionDate: ymd(today),
    sourceModule: 'FOLIO',
    sourceId: folioRes.rows[0].id,
    description: `[DEMO-FIN] Folio restaurant charge ${unit.type}`,
    lines: [
      { accountCode: '1010', debit: 450000, kredit: 0 },
      { accountCode: '4101', debit: 0, kredit: 450000 },
    ],
  })

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
      VALUES ($1, $2::date, 'RESTAURANT', $3, 450000, 450000, 'ACTIVE', $4, $5, $5)
    `,
    [folioRes.rows[0].id, ymd(today), '[DEMO-FIN] Restaurant charge', folioJournal2, actorId],
  )

  await createJournal(client, {
    unitId: unit.id,
    actorId,
    transactionDate: ymd(today),
    sourceModule: 'MANUAL_GL',
    sourceId: `DEMO-${unitTag}`,
    description: `[DEMO-FIN] Office expense ${unit.type}`,
    lines: [
      { accountCode: '5302', debit: 300000, kredit: 0 },
      { accountCode: '1001', debit: 0, kredit: 300000 },
    ],
  })

  await client.query(
    `
      INSERT INTO night_audits (
        unit_id,
        business_date,
        run_by,
        total_room_charges,
        total_folios,
        report
      )
      VALUES ($1, $2::date, $3, 850000, 1, $4::jsonb)
      ON CONFLICT (unit_id, business_date)
      DO UPDATE SET
        total_room_charges = EXCLUDED.total_room_charges,
        total_folios = EXCLUDED.total_folios,
        report = EXCLUDED.report
    `,
    [unit.id, ymd(daysFromNow(-1, 10, 0)), actorId, JSON.stringify({ source: 'DEMO_FINANCE', unit: unit.type })],
  )
}

async function main() {
  const configBase = {
    user: env('DB_USER', 'postgres'),
    host: env('DB_HOST', 'localhost'),
    port: parseInt(env('DB_PORT', '5432'), 10),
  }

  let password = process.env.DB_PASSWORD
  if (password === undefined) {
    password = await ask('DB password: ')
  }

  const dbCandidates = [process.env.DB_NAME, 'genio_db', 'genio_syariah_hotel'].filter(Boolean)
  let client = null
  let selectedDb = ''
  let lastErr = null

  for (const dbName of dbCandidates) {
    try {
      const c = new Client({
        user: configBase.user,
        host: configBase.host,
        port: configBase.port,
        database: dbName,
        password: String(password || ''),
      })
      await c.connect()
      client = c
      selectedDb = dbName
      break
    } catch (e) {
      lastErr = e
    }
  }

  if (!client) {
    throw lastErr || new Error('Gagal konek database')
  }

  try {
    console.log(`Connected to ${selectedDb}`)
    await client.query('BEGIN')

    await client.query("DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM payments WHERE reference_no LIKE 'DEMO-FIN-%')")
    await client.query("DELETE FROM payments WHERE reference_no LIKE 'DEMO-FIN-%'")
    await client.query("DELETE FROM invoices WHERE invoice_number LIKE 'DEMO-FIN-%'")
    await client.query("DELETE FROM city_ledger_accounts WHERE account_code LIKE 'DEMOFIN-%'")
    await client.query("DELETE FROM folios WHERE reservation_no LIKE 'DEMO-FIN-RES-%'")
    await client.query("DELETE FROM guests WHERE guest_name LIKE '[DEMO-FIN]%'")
    await client.query("DELETE FROM bank_accounts WHERE account_name LIKE '[DEMO-FIN] Rekening Operasional%'")
    await client.query(
      "DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE description LIKE '[DEMO-FIN]%')",
    )
    await client.query("DELETE FROM journal_entries WHERE description LIKE '[DEMO-FIN]%'")

    const unitRes = await client.query("SELECT id, type FROM units WHERE type IN ('CAFE', 'RESTO') ORDER BY id")
    if (unitRes.rows.length === 0) {
      throw new Error('Unit CAFE/RESTO belum ada')
    }

    const actorRes = await client.query(
      "SELECT id FROM users WHERE role IN ('FINANCE_MANAGER', 'SUPER_ADMIN') ORDER BY CASE WHEN role='FINANCE_MANAGER' THEN 1 ELSE 2 END LIMIT 1",
    )
    const actorId = actorRes.rows[0]?.id || null

    for (let i = 0; i < unitRes.rows.length; i += 1) {
      await seedUnitFinance(client, unitRes.rows[i], actorId, i)
    }

    await client.query('COMMIT')

    const summary = await client.query(
      `
        SELECT
          (SELECT COUNT(*) FROM city_ledger_accounts WHERE account_code LIKE 'DEMOFIN-%') AS ar_accounts,
          (SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE 'DEMO-FIN-%') AS invoices,
          (SELECT COUNT(*) FROM payments WHERE reference_no LIKE 'DEMO-FIN-%') AS payments,
          (SELECT COUNT(*) FROM folios WHERE reservation_no LIKE 'DEMO-FIN-RES-%') AS folios,
          (SELECT COUNT(*) FROM journal_entries WHERE description LIKE '[DEMO-FIN]%') AS journals,
          (SELECT COUNT(*) FROM bank_accounts WHERE account_name LIKE '[DEMO-FIN] Rekening Operasional%') AS bank_accounts
      `,
    )

    console.log('Seed finance dashboard selesai')
    console.table(summary.rows)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Seeder gagal:', e.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('Unhandled:', e.message)
  process.exit(1)
})
