import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

let pool: Pool

if (!global.pool) {
  global.pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'genio_syariah_hotel',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
  })
}
pool = global.pool

export async function getDb() {
  await initDb(pool)
  return pool
}

async function initDb(pool: Pool) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        tax_rate DECIMAL(5,2) DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        UNIQUE(unit_id, name)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        cogs INTEGER NOT NULL DEFAULT 0,
        image TEXT,
        variants TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        user_id UUID REFERENCES users(id),
        invoice_number TEXT UNIQUE NOT NULL,
        description TEXT,
        subtotal INTEGER NOT NULL,
        tax_amount INTEGER NOT NULL DEFAULT 0,
        grand_total INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        cashier_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        payment_status TEXT DEFAULT 'UNPAID',
        kitchen_status TEXT DEFAULT 'NEW',
        table_number TEXT,
        customer_name TEXT,
        order_type TEXT
      )
    `)

    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS description TEXT`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders_items (
        id BIGSERIAL PRIMARY KEY,
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        variants TEXT,
        note TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS coa (
        code TEXT PRIMARY KEY,
        account_name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        normal_balance TEXT NOT NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_lines (
        id BIGSERIAL PRIMARY KEY,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_code TEXT REFERENCES coa(code),
        debit INTEGER NOT NULL DEFAULT 0,
        kredit INTEGER NOT NULL DEFAULT 0
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS cancel_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        requested_by UUID REFERENCES users(id),
        reason TEXT,
        status TEXT DEFAULT 'PENDING',
        reviewed_by UUID REFERENCES users(id),
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS petty_cash_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        user_id UUID REFERENCES users(id),
        source_account TEXT REFERENCES coa(code),
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        receipt_proof TEXT,
        idempotency_key TEXT UNIQUE NOT NULL,
        sentinel_order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`ALTER TABLE petty_cash_entries ADD COLUMN IF NOT EXISTS receipt_proof TEXT`)

    await client.query('COMMIT')

    await seedUnits(pool)
    await seedUsers(pool)
    await seedCategories(pool)
    await seedProducts(pool)
    await seedCOA(pool)
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Failed to init DB', e)
  } finally {
    client.release()
  }
}

async function seedUnits(pool: Pool) {
  const res = await pool.query('SELECT count(*) as count FROM units')
  const count = parseInt(res.rows[0].count)
  if (count === 0) {
    await pool.query('INSERT INTO units (name, type, tax_rate) VALUES ($1, $2, $3)', [
      'AXL Coffee',
      'CAFE',
      0.11,
    ])
    await pool.query('INSERT INTO units (name, type, tax_rate) VALUES ($1, $2, $3)', [
      'AXL Resto',
      'RESTO',
      0.11,
    ])
  }
}

async function seedUsers(pool: Pool) {
  const res = await pool.query('SELECT count(*) as count FROM users')
  const count = parseInt(res.rows[0].count)
  if (count === 0) {
    const cafeRes = await pool.query("SELECT id FROM units WHERE type = 'CAFE' LIMIT 1")
    const cafeId = cafeRes.rows[0]?.id

    const restoRes = await pool.query("SELECT id FROM units WHERE type = 'RESTO' LIMIT 1")
    const restoId = restoRes.rows[0]?.id

    const password = bcrypt.hashSync('1234', 10)

    await pool.query(
      'INSERT INTO users (username, role, password, unit_id) VALUES ($1, $2, $3, $4)',
      ['jokowi', 'CASHIER', password, cafeId],
    )

    await pool.query(
      'INSERT INTO users (username, role, password, unit_id) VALUES ($1, $2, $3, $4)',
      ['windah', 'CASHIER', password, restoId],
    )

    await pool.query(
      'INSERT INTO users (username, role, password, unit_id) VALUES ($1, $2, $3, $4)',
      ['cafe_mgr', 'MANAGER', password, cafeId],
    )

    await pool.query(
      'INSERT INTO users (username, role, password, unit_id) VALUES ($1, $2, $3, $4)',
      ['resto_mgr', 'MANAGER', password, restoId],
    )
  }
}

async function seedCategories(pool: Pool) {
  const res = await pool.query('SELECT count(*) as count FROM categories')
  const count = parseInt(res.rows[0].count)
  if (count === 0) {
    const cafeRes = await pool.query("SELECT id FROM units WHERE type = 'CAFE' LIMIT 1")
    const cafeId = cafeRes.rows[0]?.id || 1

    const restoRes = await pool.query("SELECT id FROM units WHERE type = 'RESTO' LIMIT 1")
    const restoId = restoRes.rows[0]?.id || 2

    const q = 'INSERT INTO categories (unit_id, name) VALUES ($1, $2)'

    await pool.query(q, [cafeId, 'Kopi'])
    await pool.query(q, [cafeId, 'Makanan'])
    await pool.query(q, [cafeId, 'Snack'])
    await pool.query(q, [cafeId, 'Minuman'])

    await pool.query(q, [restoId, 'Makanan'])
    await pool.query(q, [restoId, 'Minuman'])
  }
}

async function seedProducts(pool: Pool) {
  const res = await pool.query('SELECT count(*) as count FROM products')
  const count = parseInt(res.rows[0].count)

  if (count === 0) {
    const cafeRes = await pool.query("SELECT id FROM units WHERE type = 'CAFE' LIMIT 1")
    const cafeId = cafeRes.rows[0]?.id || 1
    const restoRes = await pool.query("SELECT id FROM units WHERE type = 'RESTO' LIMIT 1")
    const restoId = restoRes.rows[0]?.id || 2

    const getCatId = async (unitId: number, name: string) => {
      const r = await pool.query('SELECT id FROM categories WHERE unit_id = $1 AND name = $2', [
        unitId,
        name,
      ])
      return r.rows[0]?.id
    }

    const cafeKopi = await getCatId(cafeId, 'Kopi')
    const cafeMakanan = await getCatId(cafeId, 'Makanan')
    const cafeSnack = await getCatId(cafeId, 'Snack')
    const cafeMinuman = await getCatId(cafeId, 'Minuman')
    const restoMakanan = await getCatId(restoId, 'Makanan')
    const restoMinuman = await getCatId(restoId, 'Minuman')

    const q =
      'INSERT INTO products (unit_id, category_id, name, price, cogs, image, variants) VALUES ($1, $2, $3, $4, $5, $6, $7)'

    const variantTemperature = JSON.stringify([
      {
        name: 'Suhu',
        options: [
          { name: 'Panas', price: 0 },
          { name: 'Dingin', price: 2000 },
        ],
      },
      {
        name: 'Gula',
        options: [
          { name: 'Normal', price: 0 },
          { name: 'Less Sugar', price: 0 },
          { name: 'No Sugar', price: 0 },
        ],
      },
    ])
    const variantTopping = JSON.stringify([
      {
        name: 'Topping',
        options: [
          { name: 'No Topping', price: 0 },
          { name: 'Cheese', price: 5000 },
          { name: 'Choco Chip', price: 3000 },
        ],
      },
    ])

    // --- CAFE PRODUCTS ---
    await pool.query(q, [
      cafeId,
      cafeKopi,
      'Kopi Susu Gula Aren',
      18000,
      6000,
      'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1000&auto=format&fit=crop',
      variantTemperature,
    ])
    await pool.query(q, [
      cafeId,
      cafeKopi,
      'Americano',
      15000,
      4000,
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop',
      variantTemperature,
    ])
    await pool.query(q, [
      cafeId,
      cafeKopi,
      'Cappuccino',
      20000,
      7000,
      'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=1000&auto=format&fit=crop',
      variantTemperature,
    ])
    await pool.query(q, [
      cafeId,
      cafeMakanan,
      'Croissant',
      25000,
      10000,
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=1000&auto=format&fit=crop',
      variantTopping,
    ])
    await pool.query(q, [
      cafeId,
      cafeSnack,
      'Kentang Goreng',
      15000,
      5000,
      'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(q, [
      cafeId,
      cafeMinuman,
      'Es Teh Manis',
      8000,
      2000,
      'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=1000&auto=format&fit=crop',
      JSON.stringify([
        {
          name: 'Size',
          options: [
            { name: 'Regular', price: 0 },
            { name: 'Jumbo', price: 3000 },
          ],
        },
      ]),
    ])

    // --- RESTO PRODUCTS ---
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Nasi Goreng Spesial',
      35000,
      12000,
      'https://loremflickr.com/800/600/friedrice,food/all',
      JSON.stringify([
        {
          name: 'Pedas',
          options: [
            { name: 'Tidak Pedas', price: 0 },
            { name: 'Sedang', price: 0 },
            { name: 'Pedas', price: 0 },
          ],
        },
      ]),
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Ayam Bakar Madu',
      45000,
      18000,
      'https://loremflickr.com/800/600/grilledchicken,food/all',
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMinuman,
      'Es Jeruk',
      12000,
      3000,
      'https://loremflickr.com/800/600/orangejuice,drink/all',
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Sate Ayam',
      30000,
      12000,
      'https://loremflickr.com/800/600/chickensatay,food/all',
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Sop Buntut',
      65000,
      25000,
      'https://loremflickr.com/800/600/beefsoup,food/all',
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMinuman,
      'Juice Alpukat',
      18000,
      5000,
      'https://loremflickr.com/800/600/avocadosmoothie,drink/all',
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Nasi Goreng Seafood',
      40000,
      15000,
      'https://loremflickr.com/800/600/seafoodrice,food/all',
      JSON.stringify([
        {
          name: 'Pedas',
          options: [
            { name: 'Tidak Pedas', price: 0 },
            { name: 'Sedang', price: 0 },
            { name: 'Pedas', price: 0 },
          ],
        },
      ]),
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Mie Goreng Jawa',
      32000,
      10000,
      'https://loremflickr.com/800/600/friednoodles,food/all',
      JSON.stringify([
        {
          name: 'Pedas',
          options: [
            { name: 'Tidak Pedas', price: 0 },
            { name: 'Sedang', price: 0 },
            { name: 'Pedas', price: 0 },
          ],
        },
      ]),
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Ayam Penyet',
      28000,
      10000,
      'https://loremflickr.com/800/600/friedchicken,spicy/all',
      JSON.stringify([
        {
          name: 'Sambal',
          options: [
            { name: 'Terasi', price: 0 },
            { name: 'Ijo', price: 0 },
            { name: 'Bawang', price: 0 },
          ],
        },
      ]),
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Capcay Seafood',
      35000,
      13000,
      'https://loremflickr.com/800/600/stirfryvegetables,food/all',
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMinuman,
      'Es Teh Manis',
      8000,
      2000,
      'https://loremflickr.com/800/600/icedtea,drink/all',
      '[]',
    ])
  }
}

async function seedCOA(pool: Pool) {
  const res = await pool.query('SELECT count(*) as count FROM coa')
  const count = parseInt(res.rows[0].count)

  if (count === 0) {
    const accounts = [
      { code: '1101', name: 'Kas Tunai', type: 'Asset', balance: 'Debit' },
      { code: '1102', name: 'Kas di Bank (QRIS)', type: 'Asset', balance: 'Debit' },
      { code: '1103', name: 'Kas di Bank (EDC BCA)', type: 'Asset', balance: 'Debit' },
      { code: '1104', name: 'Persediaan (Inventory)', type: 'Asset', balance: 'Debit' },
      { code: '2101', name: 'Hutang Pajak PB1', type: 'Liability', balance: 'Credit' },
      { code: '2102', name: 'Hutang Lain-lain', type: 'Liability', balance: 'Credit' },
      { code: '3101', name: 'Modal Disetor', type: 'Equity', balance: 'Credit' },
      { code: '3102', name: 'Laba Ditahan', type: 'Equity', balance: 'Credit' },
      { code: '4101', name: 'Pendapatan F&B — Restoran', type: 'Revenue', balance: 'Credit' },
      { code: '4102', name: 'Pendapatan F&B — Cafe', type: 'Revenue', balance: 'Credit' },
      { code: '4103', name: 'Pendapatan Kamar Hotel', type: 'Revenue', balance: 'Credit' },
      { code: '5101', name: 'HPP — Restoran (COGS)', type: 'Expense', balance: 'Debit' },
      { code: '5102', name: 'HPP — Cafe (COGS)', type: 'Expense', balance: 'Debit' },
      { code: '5201', name: 'Beban Operasional', type: 'Expense', balance: 'Debit' },
    ]

    for (const acc of accounts) {
      await pool.query(
        'INSERT INTO coa (code, account_name, account_type, normal_balance) VALUES ($1, $2, $3, $4)',
        [acc.code, acc.name, acc.type, acc.balance],
      )
    }
  }
}
