import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    const pool = await getDb()

    let paramId: string = id
    const isInvoice = id.startsWith('INV-')
    const idColumn = isInvoice ? 'invoice_number' : 'id'
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const existingOrderRes = await client.query(
        `SELECT * FROM orders WHERE ${idColumn} = $1 LIMIT 1`,
        [paramId],
      )

      if (existingOrderRes.rowCount === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }

      const existingOrder = existingOrderRes.rows[0]

      const updates: string[] = []
      const values: any[] = []

      if (body.payment_status) {
        const validPayment = ['UNPAID', 'PAID', 'REFUNDED', 'VOID']
        if (!validPayment.includes(body.payment_status)) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Invalid payment_status' }, { status: 400 })
        }
        values.push(body.payment_status)
        updates.push(`payment_status = $${values.length}`)
      }

      if (body.kitchen_status) {
        const validKitchen = ['NEW', 'PREPARING', 'READY', 'COMPLETED', 'CANCELED']
        if (!validKitchen.includes(body.kitchen_status)) {
          await client.query('ROLLBACK')
          return NextResponse.json({ error: 'Invalid kitchen_status' }, { status: 400 })
        }
        values.push(body.kitchen_status)
        updates.push(`kitchen_status = $${values.length}`)
      }

      if (body.payment_method) {
        values.push(body.payment_method)
        updates.push(`payment_method = $${values.length}`)
      }

      if (updates.length === 0) {
        await client.query('ROLLBACK')
        return NextResponse.json({ error: 'No valid status fields provided' }, { status: 400 })
      }

      values.push(paramId)
      const query = `UPDATE orders SET ${updates.join(', ')} WHERE ${idColumn} = $${values.length} RETURNING *`

      const res = await client.query(query, values)
      const updatedOrder = res.rows[0]

      const becamePaid = existingOrder.payment_status !== 'PAID' && updatedOrder.payment_status === 'PAID'

      if (becamePaid) {
        const existingJournalRes = await client.query(
          'SELECT id FROM journal_entries WHERE order_id = $1 LIMIT 1',
          [updatedOrder.id],
        )

        if (existingJournalRes.rowCount === 0) {
          const itemsRes = await client.query(
            `
              SELECT oi.qty, COALESCE(p.cogs, 0) as cogs
              FROM orders_items oi
              LEFT JOIN products p ON oi.product_id = p.id
              WHERE oi.order_id = $1
            `,
            [updatedOrder.id],
          )

          const totalCogs = itemsRes.rows.reduce(
            (sum: number, item: { qty: number; cogs: number }) => sum + Number(item.cogs) * Number(item.qty),
            0,
          )

          const unitRes = await client.query('SELECT type FROM units WHERE id = $1', [updatedOrder.unit_id])
          const unitType = unitRes.rows[0]?.type || 'POS'
          const paymentMethod = body.payment_method || updatedOrder.payment_method || existingOrder.payment_method

          let kasAccount = '1101'
          if (paymentMethod === 'QRIS') kasAccount = '1102'
          else if (paymentMethod === 'CARD' || paymentMethod === 'DEBIT') kasAccount = '1103'

          const isResto = unitType === 'RESTO'
          const pendapatanAccount = isResto ? '4101' : '4102'
          const hppAccount = isResto ? '5101' : '5102'
          const hutangPajakAccount = '2101'
          const persediaanAccount = '1104'
          const description = `Penjualan ${unitType} - ${updatedOrder.invoice_number}`

          const journalRes = await client.query(
            `
              INSERT INTO journal_entries (unit_id, order_id, description)
              VALUES ($1, $2, $3)
              RETURNING id
            `,
            [updatedOrder.unit_id, updatedOrder.id, description],
          )

          const journalId = journalRes.rows[0].id
          const insertLineQuery =
            'INSERT INTO journal_lines (journal_entry_id, account_code, debit, kredit) VALUES ($1, $2, $3, $4)'

          await client.query(insertLineQuery, [journalId, kasAccount, updatedOrder.grand_total, 0])
          await client.query(insertLineQuery, [journalId, pendapatanAccount, 0, updatedOrder.subtotal])

          if (Number(updatedOrder.tax_amount) > 0) {
            await client.query(insertLineQuery, [journalId, hutangPajakAccount, 0, updatedOrder.tax_amount])
          }

          if (totalCogs > 0) {
            await client.query(insertLineQuery, [journalId, hppAccount, totalCogs, 0])
            await client.query(insertLineQuery, [journalId, persediaanAccount, 0, totalCogs])
          }
        }
      }

      await client.query('COMMIT')

      return NextResponse.json(updatedOrder)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
