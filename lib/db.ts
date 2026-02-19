import { Pool } from 'pg'

let pool: Pool

if (!global.pool) {
  global.pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'pos',
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

    // 1. Units Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS units (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        tax_rate DECIMAL(5,2) DEFAULT 0
      )
    `)

    // 2. Users Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id),
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 3. Products Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        variants TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 4. Orders Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id),
        user_id INTEGER REFERENCES users(id),
        invoice_number TEXT UNIQUE NOT NULL,
        subtotal INTEGER NOT NULL,
        tax_amount INTEGER NOT NULL DEFAULT 0,
        grand_total INTEGER NOT NULL,
        payment_method TEXT NOT NULL,
        cashier_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'PENDING',
        table_number TEXT,
        customer_name TEXT,
        order_type TEXT
      )
    `)

    // 6. Order Items Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS orders_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
        product_id INTEGER,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        qty INTEGER NOT NULL,
        total_price INTEGER NOT NULL,
        variants TEXT
      )
    `)

    await client.query('COMMIT')

    // Seed Data
    await seedUnits(pool)
    await seedUsers(pool)
    await seedProducts(pool)
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

    // Password '1234' buat semua user
    const password = '1234'

    // Admin (Global)
    await pool.query('INSERT INTO users (username, role, password) VALUES ($1, $2, $3)', [
      'admin',
      'ADMIN',
      password,
    ])

    // Cafe Cashier (Jokowi)
    await pool.query(
      'INSERT INTO users (username, role, password, unit_id) VALUES ($1, $2, $3, $4)',
      ['jokowi', 'CASHIER', password, cafeId],
    )

    // Manager (Global)
    await pool.query('INSERT INTO users (username, role, password) VALUES ($1, $2, $3)', [
      'manager',
      'MANAGER',
      password,
    ])

    // Resto Cashier (Windah)
    await pool.query(
      'INSERT INTO users (username, role, password, unit_id) VALUES ($1, $2, $3, $4)',
      ['windah', 'CASHIER', password, restoId],
    )
  }
}

async function seedProducts(pool: Pool) {
  const res = await pool.query('SELECT count(*) as count FROM products')
  const count = parseInt(res.rows[0].count)

  if (count === 0) {
    console.log('Seeding initial products...')
    const unitRes = await pool.query("SELECT id FROM units WHERE type = 'CAFE' LIMIT 1")
    const cafeId = unitRes.rows[0]?.id || 1

    const query =
      'INSERT INTO products (unit_id, name, price, category, image, variants) VALUES ($1, $2, $3, $4, $5, $6)'

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

    await pool.query(query, [
      cafeId,
      'Kopi Susu Gula Aren',
      18000,
      'Kopi',
      'https://images.unsplash.com/photo-1541167760496-1628856ab772?q=80&w=1000&auto=format&fit=crop',
      variantTemperature,
    ])
    await pool.query(query, [
      cafeId,
      'Americano',
      15000,
      'Kopi',
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?q=80&w=1000&auto=format&fit=crop',
      variantTemperature,
    ])
    await pool.query(query, [
      cafeId,
      'Cappuccino',
      20000,
      'Kopi',
      'https://images.unsplash.com/photo-1572442388796-11668a67e53d?q=80&w=1000&auto=format&fit=crop',
      variantTemperature,
    ])
    await pool.query(query, [
      cafeId,
      'Croissant',
      25000,
      'Makanan',
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?q=80&w=1000&auto=format&fit=crop',
      variantTopping,
    ])
    await pool.query(query, [
      cafeId,
      'Kentang Goreng',
      15000,
      'Snack',
      'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(query, [
      cafeId,
      'Es Teh Manis',
      8000,
      'Minuman',
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

    // Seed Restaurant Products
    console.log('Seeding restaurant products...')
    const restoRes = await pool.query("SELECT id FROM units WHERE type = 'RESTO' LIMIT 1")
    const restoId = restoRes.rows[0]?.id || 2

    const restoQuery =
      'INSERT INTO products (unit_id, name, price, category, image, variants) VALUES ($1, $2, $3, $4, $5, $6)'

    await pool.query(restoQuery, [
      restoId,
      'Nasi Goreng Spesial',
      35000,
      'Makanan',
      'https://images.unsplash.com/photo-1603133872878-684f10d6a1f8?q=80&w=1000&auto=format&fit=crop',
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
    await pool.query(restoQuery, [
      restoId,
      'Ayam Bakar Madu',
      45000,
      'Makanan',
      'https://images.unsplash.com/photo-1626082927389-6cd097cdc6a0?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(restoQuery, [
      restoId,
      'Es Jeruk',
      12000,
      'Minuman',
      'https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(restoQuery, [
      restoId,
      'Sate Ayam',
      30000,
      'Makanan',
      'https://images.unsplash.com/photo-1520072959219-c595dc3f3bc4?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(restoQuery, [
      restoId,
      'Sop Buntut',
      65000,
      'Makanan',
      'https://images.unsplash.com/photo-1549203438-a7696aed470e?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(restoQuery, [
      restoId,
      'Juice Alpukat',
      18000,
      'Minuman',
      'https://images.unsplash.com/photo-1601039641847-7857b994d704?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(restoQuery, [
      restoId,
      'Nasi Goreng Seafood',
      40000,
      'Makanan',
      'https://images.unsplash.com/photo-1512058564366-18510be2db19?q=80&w=1000&auto=format&fit=crop',
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
    await pool.query(restoQuery, [
      restoId,
      'Mie Goreng Jawa',
      32000,
      'Makanan',
      'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?q=80&w=1000&auto=format&fit=crop',
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
    await pool.query(restoQuery, [
      restoId,
      'Ayam Penyet',
      28000,
      'Makanan',
      'https://images.unsplash.com/photo-1649912061986-e793910c71cc?q=80&w=1000&auto=format&fit=crop',
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
    await pool.query(restoQuery, [
      restoId,
      'Capcay Seafood',
      35000,
      'Makanan',
      'https://images.unsplash.com/photo-1585032226651-759b368d7246?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
    await pool.query(restoQuery, [
      restoId,
      'Es Teh Manis',
      8000,
      'Minuman',
      'https://images.unsplash.com/photo-1556679343-c7306c1976bc?q=80&w=1000&auto=format&fit=crop',
      '[]',
    ])
  }
}
