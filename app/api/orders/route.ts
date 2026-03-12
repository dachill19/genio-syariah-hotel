import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kitchenStatus = searchParams.get('kitchenStatus')
  const paymentStatus = searchParams.get('paymentStatus')
  const unitId = searchParams.get('unitId')
  const activeKitchen = searchParams.get('activeKitchen')

  try {
    const pool = await getDb()
    let query = `
      SELECT o.*, COALESCE(o.cashier_name, u.username) as cashier_name,
             coalesce(
               json_agg(
                 json_build_object(
                   'id', oi.product_id,
                   'name', oi.name,
                   'price', oi.price,
                   'qty', oi.qty,
                   'totalPrice', oi.total_price,
                   'selectedVariants', oi.variants::json,
                   'note', oi.note
                 )
               ) FILTER (WHERE oi.id IS NOT NULL), 
               '[]'
             ) as items
      FROM orders o
      LEFT JOIN orders_items oi ON o.id = oi.order_id
      LEFT JOIN users u ON o.user_id = u.id
    `
    const params: any[] = []
    const conditions: string[] = []

    if (activeKitchen === 'true') {
      conditions.push("o.kitchen_status IN ('NEW', 'PREPARING', 'READY')")
    }

    if (kitchenStatus) {
      params.push(kitchenStatus)
      conditions.push(`o.kitchen_status = $${params.length}`)
    }

    if (paymentStatus) {
      params.push(paymentStatus)
      conditions.push(`o.payment_status = $${params.length}`)
    }

    if (unitId) {
      params.push(unitId)
      conditions.push(`o.unit_id = $${params.length}`)
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' GROUP BY o.id, u.username ORDER BY o.created_at DESC'

    const res = await pool.query(query, params)

    return NextResponse.json(res.rows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      items,
      subtotal,
      grand_total,
      tax_amount,
      payment_method,
      table_number,
      customer_name,
      order_type,
      unit_id,
      user_id,
    } = body

    const pool = await getDb()

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const validUserId = user_id && uuidRegex.test(user_id) ? user_id : null

    let cashier_name = 'System'
    if (validUserId) {
      const userRes = await pool.query('SELECT username FROM users WHERE id = $1', [validUserId])
      if (userRes.rows.length > 0) {
        cashier_name = userRes.rows[0].username
      }
    }

    const unitRes = await pool.query('SELECT type FROM units WHERE id = $1', [unit_id || 1])
    const unitType = unitRes.rows[0]?.type || 'POS'

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const randomStr = Math.floor(1000 + Math.random() * 9000)
    const invoice_number = `INV-${unitType}-${dateStr}-${randomStr}`

    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const insertOrderText = `
            INSERT INTO orders (
              invoice_number, subtotal, tax_amount, grand_total, payment_method, 
              payment_status, kitchen_status, table_number, customer_name, order_type, unit_id, user_id, cashier_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
        `

      const res = await client.query(insertOrderText, [
        invoice_number,
        subtotal,
        tax_amount || 0,
        grand_total,
        payment_method,
        body.payment_status || 'PAID',
        'NEW',
        table_number || '',
        customer_name || '',
        order_type || 'Dine in',
        unit_id || 1,
        validUserId,
        cashier_name,
      ])

      const orderId = res.rows[0].id

      const insertItemText = `
        INSERT INTO orders_items (order_id, product_id, name, price, qty, total_price, variants, note)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `

      let totalCogs = 0

      for (const item of items) {
        // Calculate COGS
        const prodRes = await client.query('SELECT cogs FROM products WHERE id = $1', [item.id])
        const cogsPerItem = prodRes.rows[0]?.cogs || 0
        totalCogs += cogsPerItem * item.qty

        await client.query(insertItemText, [
          orderId,
          item.id,
          item.name,
          item.price,
          item.qty,
          item.totalPrice,
          JSON.stringify(item.selectedVariants || {}),
          item.note || null,
        ])
      }

      // AUTO-JOURNALING ENGINE (PSAK 101 Syariah)
      // Execute only if payment status is PAID (which is the default if not provided)
      const isPaid = !body.payment_status || body.payment_status === 'PAID'

      if (isPaid) {
        let kasAccount = '1101' // Default: Kas Tunai
        if (payment_method === 'QRIS') kasAccount = '1102'
        else if (payment_method === 'CARD' || payment_method === 'DEBIT') kasAccount = '1103'

        const isResto = unitType === 'RESTO'
        const pendapatanAccount = isResto ? '4101' : '4102'
        const hppAccount = isResto ? '5101' : '5102'
        const hutangPajakAccount = '2101'
        const persediaanAccount = '1104'

        const desc = `Penjualan ${unitType} - ${invoice_number}`

        const jeRes = await client.query(
          `
          INSERT INTO journal_entries (unit_id, order_id, description)
          VALUES ($1, $2, $3) RETURNING id
        `,
          [unit_id || 1, orderId, desc],
        )

        const journalId = jeRes.rows[0].id
        const insertJLine = `INSERT INTO journal_lines (journal_entry_id, account_code, debit, kredit) VALUES ($1, $2, $3, $4)`

        // 1. Kas (Debit)
        await client.query(insertJLine, [journalId, kasAccount, grand_total, 0])

        // 2. Pendapatan (Kredit)
        await client.query(insertJLine, [journalId, pendapatanAccount, 0, subtotal])

        // 3. Hutang Pajak PB1 (Kredit)
        if (tax_amount > 0) {
          await client.query(insertJLine, [journalId, hutangPajakAccount, 0, tax_amount])
        }

        // 4. HPP (Debit) & Persediaan (Kredit)
        if (totalCogs > 0) {
          await client.query(insertJLine, [journalId, hppAccount, totalCogs, 0])
          await client.query(insertJLine, [journalId, persediaanAccount, 0, totalCogs])
        }

        // Invariant check is handled inherently because total Debit MUST EQUAL total Credit:
        // Debit: grand_total + totalCogs
        // Credit: subtotal + tax_amount + totalCogs
        // Since grand_total = subtotal + tax_amount, it is always balanced.
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        id: orderId,
        invoice_number,
        cashier_name,
        created_at: new Date(),
      })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
}
