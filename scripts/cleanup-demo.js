/* eslint-disable no-console */
const { Client } = require('pg')
const readline = require('readline')
const { unlink } = require('fs/promises')
const path = require('path')

const DEMO_PREFIX = 'DEMO-'
const DEMO_TAG = '[DEMO]'

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

async function connectClient() {
  const configBase = {
    user: env('DB_USER', 'postgres'),
    host: env('DB_HOST', 'localhost'),
    port: parseInt(env('DB_PORT', '5432'), 10),
  }

  let password = process.env.DB_PASSWORD
  if (password === undefined) {
    password = await ask(
      `DB password for ${configBase.user}@${configBase.host} (kosongkan jika tidak pakai): `,
    )
  }

  const finalPassword = String(password ?? '')
  const dbCandidates = [process.env.DB_NAME, 'genio_db', 'genio_syariah_hotel'].filter(Boolean)

  let client = null
  let selectedDb = ''
  let lastConnectError = null

  for (const dbName of dbCandidates) {
    try {
      const c = new Client({
        ...configBase,
        database: dbName,
        password: finalPassword,
      })
      await c.connect()
      client = c
      selectedDb = dbName
      break
    } catch (err) {
      lastConnectError = err
    }
  }

  if (!client) {
    throw lastConnectError || new Error('Gagal koneksi ke database')
  }

  return { client, selectedDb }
}

async function main() {
  const { client, selectedDb } = await connectClient()
  const deletedReceiptFiles = []
  const failedReceiptFiles = []

  try {
    console.log(`Connected to database: ${selectedDb}`)
    await client.query('BEGIN')

    const receiptRes = await client.query(
      `
        SELECT receipt_proof
        FROM petty_cash_entries
        WHERE description LIKE $1
          AND receipt_proof IS NOT NULL
          AND receipt_proof LIKE '/receipts/%'
      `,
      [`${DEMO_TAG}%`],
    )

    const receiptPaths = receiptRes.rows
      .map((r) => String(r.receipt_proof || '').trim())
      .filter((p) => p.length > 0)

    const deleteCancelRequestsRes = await client.query(
      `DELETE FROM cancel_requests WHERE reason LIKE $1`,
      [`${DEMO_TAG}%`],
    )

    const deletePettyCashRes = await client.query(
      `DELETE FROM petty_cash_entries WHERE description LIKE $1`,
      [`${DEMO_TAG}%`],
    )

    const deleteJournalLinesRes = await client.query(
      `
        DELETE FROM journal_lines
        WHERE journal_entry_id IN (
          SELECT id FROM journal_entries WHERE description LIKE $1
        )
      `,
      [`${DEMO_TAG}%`],
    )

    const deleteJournalEntriesRes = await client.query(
      `DELETE FROM journal_entries WHERE description LIKE $1`,
      [`${DEMO_TAG}%`],
    )

    const deleteOrdersRes = await client.query(
      `DELETE FROM orders WHERE invoice_number LIKE $1`,
      [`${DEMO_PREFIX}%`],
    )

    await client.query('COMMIT')

    for (const receiptPath of receiptPaths) {
      const relativePath = receiptPath.replace(/^\/+/, '').replace(/\//g, path.sep)
      const absolutePath = path.join(process.cwd(), 'public', relativePath)
      try {
        await unlink(absolutePath)
        deletedReceiptFiles.push(receiptPath)
      } catch {
        failedReceiptFiles.push(receiptPath)
      }
    }

    console.log('Demo cleanup selesai.')
    console.table([
      {
        deleted_orders: deleteOrdersRes.rowCount,
        deleted_cancel_requests: deleteCancelRequestsRes.rowCount,
        deleted_petty_cash_entries: deletePettyCashRes.rowCount,
        deleted_journal_entries: deleteJournalEntriesRes.rowCount,
        deleted_journal_lines: deleteJournalLinesRes.rowCount,
        deleted_receipt_files: deletedReceiptFiles.length,
        failed_receipt_files: failedReceiptFiles.length,
      },
    ])

    if (failedReceiptFiles.length > 0) {
      console.log('Warning: beberapa file receipt tidak ditemukan saat dihapus (aman, data DB sudah bersih).')
    }
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Cleanup gagal:', err.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error('Unhandled cleanup error:', err)
  process.exit(1)
})
