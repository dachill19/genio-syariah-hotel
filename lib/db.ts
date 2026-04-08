import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

if (!global.pool) {
  global.pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'genio_syariah_hotel',
    password: process.env.DB_PASSWORD || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
  })
}
const pool: Pool = global.pool

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
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, permission_id)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT,
        old_value JSONB,
        new_value JSONB,
        ip_address TEXT,
        correlation_id TEXT,
        metadata JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS table_name TEXT`)
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS record_id TEXT`)
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS old_value JSONB`)
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS new_value JSONB`)
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT`)
    await client.query(`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS correlation_id TEXT`)

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

    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS parent_code TEXT REFERENCES coa(code) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS exclude_from_occupancy BOOLEAN NOT NULL DEFAULT false`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE coa ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS fiscal_years (
        id SERIAL PRIMARY KEY,
        year INTEGER UNIQUE NOT NULL,
        starts_on DATE NOT NULL,
        ends_on DATE NOT NULL,
        is_closed BOOLEAN NOT NULL DEFAULT false,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS accounting_periods (
        id SERIAL PRIMARY KEY,
        fiscal_year_id INTEGER REFERENCES fiscal_years(id) ON DELETE CASCADE,
        period_number INTEGER NOT NULL,
        starts_on DATE NOT NULL,
        ends_on DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        locked_at TIMESTAMP,
        locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
        lock_reason TEXT,
        closed_at TIMESTAMP,
        closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(fiscal_year_id, period_number)
      )
    `)

    await client.query(`ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP`)
    await client.query(`ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS lock_reason TEXT`)
    await client.query(`ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP`)
    await client.query(`ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id) ON DELETE SET NULL`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS exchange_rates (
        id BIGSERIAL PRIMARY KEY,
        rate_date DATE NOT NULL,
        from_currency TEXT NOT NULL,
        to_currency TEXT NOT NULL DEFAULT 'IDR',
        rate BIGINT NOT NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(rate_date, from_currency, to_currency)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id BIGSERIAL PRIMARY KEY,
        unit_id INTEGER REFERENCES units(id),
        account_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        bank_name TEXT,
        currency_code TEXT NOT NULL DEFAULT 'IDR',
        account_type TEXT NOT NULL DEFAULT 'BANK',
        gl_account_code TEXT REFERENCES coa(code),
        opening_balance BIGINT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bank_account_id BIGINT REFERENCES bank_accounts(id),
        unit_id INTEGER REFERENCES units(id),
        trx_date DATE NOT NULL,
        trx_type TEXT NOT NULL,
        description TEXT,
        amount BIGINT NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'IDR',
        exchange_rate BIGINT NOT NULL DEFAULT 1,
        amount_base BIGINT NOT NULL,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS guests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        guest_name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS folios (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
        reservation_no TEXT,
        room_number TEXT NOT NULL,
        check_in_date DATE NOT NULL,
        check_out_date DATE NOT NULL,
        room_rate BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'OPEN',
        closed_at TIMESTAMP,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS folio_charges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        folio_id UUID REFERENCES folios(id) ON DELETE CASCADE,
        charge_date DATE NOT NULL,
        charge_type TEXT NOT NULL,
        description TEXT,
        amount BIGINT NOT NULL,
        currency_code TEXT NOT NULL DEFAULT 'IDR',
        exchange_rate BIGINT NOT NULL DEFAULT 1,
        amount_base BIGINT NOT NULL,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        reason TEXT,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
        reversed_charge_id UUID REFERENCES folio_charges(id) ON DELETE SET NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS folio_daily_postings (
        id BIGSERIAL PRIMARY KEY,
        folio_id UUID REFERENCES folios(id) ON DELETE CASCADE,
        business_date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(folio_id, business_date)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS unit_business_dates (
        unit_id INTEGER PRIMARY KEY REFERENCES units(id) ON DELETE CASCADE,
        business_date DATE NOT NULL,
        last_night_audit_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS night_audits (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        business_date DATE NOT NULL,
        run_by UUID REFERENCES users(id) ON DELETE SET NULL,
        total_room_charges BIGINT NOT NULL DEFAULT 0,
        total_folios INTEGER NOT NULL DEFAULT 0,
        report JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(unit_id, business_date)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_number TEXT UNIQUE,
        period_id INTEGER REFERENCES accounting_periods(id) ON DELETE SET NULL,
        unit_id INTEGER REFERENCES units(id),
        order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
        source_id TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS journal_type TEXT NOT NULL DEFAULT 'GENERAL'`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS posting_status TEXT NOT NULL DEFAULT 'POSTED'`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_module TEXT`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reference_no TEXT`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS journal_number TEXT`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS period_id INTEGER REFERENCES accounting_periods(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS source_id TEXT`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL`)

    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_journal_number_uq ON journal_entries (journal_number) WHERE journal_number IS NOT NULL`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_sequences (
        period_id INTEGER PRIMARY KEY REFERENCES accounting_periods(id) ON DELETE CASCADE,
        last_sequence BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS posting_account_mappings (
        id BIGSERIAL PRIMARY KEY,
        module_code TEXT NOT NULL,
        event_code TEXT NOT NULL,
        key_code TEXT NOT NULL DEFAULT '*',
        debit_account_code TEXT REFERENCES coa(code),
        credit_account_code TEXT REFERENCES coa(code),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE(module_code, event_code, key_code)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS journal_lines (
        id BIGSERIAL PRIMARY KEY,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
        account_code TEXT REFERENCES coa(code),
        debit BIGINT NOT NULL DEFAULT 0,
        kredit BIGINT NOT NULL DEFAULT 0
      )
    `)

    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS description TEXT`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'IDR'`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS foreign_amount BIGINT`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS exchange_rate BIGINT DEFAULT 1`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS base_amount BIGINT`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES units(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES users(id) ON DELETE SET NULL`)
    await client.query(`ALTER TABLE journal_lines ALTER COLUMN debit TYPE BIGINT USING debit::bigint`)
    await client.query(`ALTER TABLE journal_lines ALTER COLUMN kredit TYPE BIGINT USING kredit::bigint`)
    await client.query(`ALTER TABLE journal_lines ALTER COLUMN exchange_rate TYPE BIGINT USING COALESCE(exchange_rate, 1)::bigint`)

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

    await client.query(`
      CREATE TABLE IF NOT EXISTS city_ledger_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        account_name TEXT NOT NULL,
        account_code TEXT UNIQUE NOT NULL,
        credit_limit BIGINT NOT NULL DEFAULT 0,
        payment_terms_days INTEGER NOT NULL DEFAULT 30,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        city_ledger_account_id UUID REFERENCES city_ledger_accounts(id),
        invoice_number TEXT UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal_amount BIGINT NOT NULL,
        tax_amount BIGINT NOT NULL DEFAULT 0,
        total_amount BIGINT NOT NULL,
        paid_amount BIGINT NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ISSUED',
        source_module TEXT,
        source_id TEXT,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_lines (
        id BIGSERIAL PRIMARY KEY,
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
        line_no INTEGER NOT NULL,
        description TEXT NOT NULL,
        account_code TEXT REFERENCES coa(code),
        amount BIGINT NOT NULL,
        tax_amount BIGINT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(invoice_id, line_no)
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        unit_id INTEGER REFERENCES units(id),
        city_ledger_account_id UUID REFERENCES city_ledger_accounts(id),
        payment_date DATE NOT NULL,
        payment_method TEXT NOT NULL,
        amount BIGINT NOT NULL,
        reference_no TEXT,
        notes TEXT,
        journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        updated_by UUID REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_allocations (
        id BIGSERIAL PRIMARY KEY,
        payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
        allocated_amount BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(payment_id, invoice_id)
      )
    `)

    await client.query('COMMIT')

    await seedUnits(pool)
    await seedUsers(pool)
    await seedRolesAndPermissions(pool)
    await seedCategories(pool)
    await seedProducts(pool)
    await seedCOA(pool)
    await seedPostingMappings(pool)
    await seedFiscalPeriods(pool)
    await seedBusinessDates(pool)
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
  const cafeRes = await pool.query("SELECT id FROM units WHERE type = 'CAFE' LIMIT 1")
  const cafeId = cafeRes.rows[0]?.id

  const restoRes = await pool.query("SELECT id FROM units WHERE type = 'RESTO' LIMIT 1")
  const restoId = restoRes.rows[0]?.id

  if (!cafeId || !restoId) return

  const password = bcrypt.hashSync('1234', 10)

  const requiredUsers = [
    { username: 'cafe_csr_1', role: 'CASHIER', unitId: cafeId },
    { username: 'cafe_csr_2', role: 'CASHIER', unitId: cafeId },
    { username: 'resto_csr_1', role: 'CASHIER', unitId: restoId },
    { username: 'resto_csr_2', role: 'CASHIER', unitId: restoId },
    { username: 'cafe_mgr', role: 'MANAGER', unitId: cafeId },
    { username: 'resto_mgr', role: 'MANAGER', unitId: restoId },
    { username: 'finance_mgr', role: 'FINANCE_MANAGER', unitId: null },
  ]

  for (const user of requiredUsers) {
    await pool.query(
      `
        INSERT INTO users (username, role, password, unit_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (username)
        DO UPDATE SET role = EXCLUDED.role, unit_id = EXCLUDED.unit_id
      `,
      [user.username, user.role, password, user.unitId],
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

async function seedRolesAndPermissions(pool: Pool) {
  const roles = [
    { name: 'BILLER', description: 'Create invoices and post charges' },
    { name: 'CASHIER', description: 'Receive payments and record cash transactions' },
    { name: 'SUPERVISOR', description: 'Approve voids and overrides' },
    { name: 'DEPOSIT_PREPARER', description: 'Prepare deposits and deposit records' },
    { name: 'RECONCILER', description: 'Bank reconciliation and audit read access' },
    { name: 'GENERAL_MANAGER', description: 'Executive approval and dashboards' },
    { name: 'DEPARTMENT_HEAD', description: 'Department budget and reports' },
    { name: 'SUPER_ADMIN', description: 'Full system access' },
    { name: 'FINANCE_MANAGER', description: 'Finance module access' },
    { name: 'AUDITOR', description: 'Read-only audit access' },
    { name: 'MANAGER', description: 'POS manager access' },
  ]

  const permissions = [
    { code: 'finance.coa.read', description: 'Read chart of accounts' },
    { code: 'finance.coa.write', description: 'Create and update chart of accounts' },
    { code: 'finance.gl.read', description: 'Read general ledger data' },
    { code: 'finance.gl.post', description: 'Post general ledger journals' },
    { code: 'finance.period.lock', description: 'Lock accounting periods' },
    { code: 'finance.period.close', description: 'Close accounting periods' },
    { code: 'finance.cash.read', description: 'Read cash module data' },
    { code: 'finance.cash.write', description: 'Create cash transactions' },
    { code: 'finance.bank.reconcile', description: 'Perform bank reconciliation' },
    { code: 'finance.folio.read', description: 'Read folio data' },
    { code: 'finance.folio.write', description: 'Create and update folio data' },
    { code: 'finance.folio.void', description: 'Void folio charges' },
    { code: 'finance.audit.read', description: 'Read audit logs' },
    { code: 'pos.read', description: 'Read POS data' },
    { code: 'pos.write', description: 'Create and update POS data' },
    { code: 'pos.manage', description: 'Manage POS menu and operations' },
  ]

  for (const role of roles) {
    await pool.query(
      `
        INSERT INTO roles (name, description)
        VALUES ($1, $2)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      `,
      [role.name, role.description],
    )
  }

  for (const permission of permissions) {
    await pool.query(
      `
        INSERT INTO permissions (code, description)
        VALUES ($1, $2)
        ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description
      `,
      [permission.code, permission.description],
    )
  }

  const matrix: Record<string, string[]> = {
    BILLER: ['finance.folio.read', 'finance.folio.write'],
    CASHIER: ['finance.cash.read', 'finance.cash.write', 'finance.folio.read'],
    SUPERVISOR: ['finance.cash.read', 'finance.folio.read', 'finance.folio.void', 'pos.manage'],
    DEPOSIT_PREPARER: ['finance.cash.read', 'finance.cash.write'],
    RECONCILER: ['finance.gl.read', 'finance.bank.reconcile', 'finance.audit.read'],
    GENERAL_MANAGER: ['finance.coa.read', 'finance.gl.read', 'finance.audit.read'],
    DEPARTMENT_HEAD: ['finance.coa.read', 'finance.gl.read', 'finance.folio.read'],
    SUPER_ADMIN: [
      'finance.coa.read',
      'finance.coa.write',
      'finance.gl.read',
      'finance.gl.post',
      'finance.period.lock',
      'finance.period.close',
      'finance.cash.read',
      'finance.cash.write',
      'finance.bank.reconcile',
      'finance.folio.read',
      'finance.folio.write',
      'finance.folio.void',
      'finance.audit.read',
      'pos.read',
      'pos.write',
      'pos.manage',
    ],
    FINANCE_MANAGER: [
      'finance.coa.read',
      'finance.coa.write',
      'finance.gl.read',
      'finance.gl.post',
      'finance.period.lock',
      'finance.period.close',
      'finance.cash.read',
      'finance.cash.write',
      'finance.bank.reconcile',
      'finance.folio.read',
      'finance.folio.write',
      'finance.folio.void',
      'finance.audit.read',
    ],
    AUDITOR: ['finance.coa.read', 'finance.gl.read', 'finance.audit.read', 'pos.read'],
    MANAGER: ['pos.read', 'pos.write', 'pos.manage'],
  }

  for (const roleName of Object.keys(matrix)) {
    const roleRes = await pool.query('SELECT id FROM roles WHERE name = $1', [roleName])
    const roleId = roleRes.rows[0]?.id
    if (!roleId) continue

    for (const permissionCode of matrix[roleName]) {
      const permRes = await pool.query('SELECT id FROM permissions WHERE code = $1', [permissionCode])
      const permissionId = permRes.rows[0]?.id
      if (!permissionId) continue

      await pool.query(
        `
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `,
        [roleId, permissionId],
      )
    }
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
      null,
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
      null,
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMinuman,
      'Es Jeruk',
      12000,
      3000,
      null,
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Sate Ayam',
      30000,
      12000,
      null,
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Sop Buntut',
      65000,
      25000,
      null,
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMinuman,
      'Juice Alpukat',
      18000,
      5000,
      null,
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMakanan,
      'Nasi Goreng Seafood',
      40000,
      15000,
      null,
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
      null,
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
      null,
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
      null,
      '[]',
    ])
    await pool.query(q, [
      restoId,
      restoMinuman,
      'Es Teh Manis',
      8000,
      2000,
      null,
      '[]',
    ])
  }
}

async function seedCOA(pool: Pool) {
  const accounts = [
    { code: '1001', name: 'Cash on Hand', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1002', name: 'Cash in Bank (IDR)', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1003', name: 'Cash in Bank (USD)', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1004', name: 'Petty Cash - Front Desk', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1005', name: 'Petty Cash - F&B', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1010', name: 'Accounts Receivable - City Ledger', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1011', name: 'Accounts Receivable - OTA', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1020', name: 'Inventories - F&B', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1021', name: 'Inventories - Housekeeping Supplies', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1022', name: 'Inventories - Amenities', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1030', name: 'Prepaid Expenses', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1100', name: 'Fixed Assets - Building', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1101', name: 'Fixed Assets - Furniture & Equipment', type: 'Asset', balance: 'Debit', excludeFromOccupancy: false },
    { code: '1102', name: 'Accumulated Depreciation - Building', type: 'Asset', balance: 'Credit', excludeFromOccupancy: false },
    { code: '1103', name: 'Accumulated Depreciation - FF&E', type: 'Asset', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2001', name: 'Accounts Payable - Suppliers', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2010', name: 'Accrued Wages Payable', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2011', name: 'Service Charge Payable', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2012', name: 'BPJS Ketenagakerjaan Payable', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2013', name: 'BPJS Kesehatan Payable', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2014', name: 'PPh 21 Payable', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2015', name: 'PPN Payable (11%)', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2020', name: 'Guest Deposits', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '2030', name: 'Deferred Revenue', type: 'Liability', balance: 'Credit', excludeFromOccupancy: false },
    { code: '3001', name: "Owner's Capital", type: 'Equity', balance: 'Credit', excludeFromOccupancy: false },
    { code: '3002', name: 'Retained Earnings', type: 'Equity', balance: 'Credit', excludeFromOccupancy: false },
    { code: '3003', name: 'Current Year Earnings', type: 'Equity', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4001', name: 'Room Revenue - Regular Rate', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4002', name: 'Room Revenue - Complimentary', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4003', name: 'Room Revenue - Day Use', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: true },
    { code: '4101', name: 'F&B Revenue - Restaurant', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4102', name: 'F&B Revenue - Bar / Alcoholic Beverages', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4103', name: 'F&B Revenue - Non-Alcoholic Beverages', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4104', name: 'F&B Revenue - Room Service', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4201', name: 'Other Revenue - Laundry', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4202', name: 'Other Revenue - Parking', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4203', name: 'Other Revenue - Spa', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4204', name: 'Other Revenue - Internet/WiFi Premium', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4205', name: 'Other Revenue - Minibar', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4301', name: 'Miscellaneous Revenue - Late Checkout Fee', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4302', name: 'Miscellaneous Revenue - Cancellation Fee', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '4401', name: 'Service Charge Collected', type: 'Revenue', balance: 'Credit', excludeFromOccupancy: false },
    { code: '5001', name: 'Room Dept - Housekeeping Supplies', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5002', name: 'Room Dept - Linen & Laundry', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5003', name: 'Room Dept - Amenities', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5004', name: 'Room Dept - Wages', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5101', name: 'F&B Dept - Cost of Food Sold', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5102', name: 'F&B Dept - Cost of Beverage Sold', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5103', name: 'F&B Dept - Wages', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5301', name: 'Admin & General - Management Salaries', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5302', name: 'Admin & General - Office Supplies', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5303', name: 'Admin & General - Legal & Professional Fees', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5401', name: 'Sales & Marketing - OTA Commission', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5402', name: 'Sales & Marketing - Paid Search / Digital Ads', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5403', name: 'Sales & Marketing - Social Media', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5501', name: 'Property Operations - Electricity', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5502', name: 'Property Operations - Water', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5503', name: 'Property Operations - Gas', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5504', name: 'Property Operations - Internet Infrastructure', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5505', name: 'Property Operations - Maintenance & Repairs', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5601', name: 'Service Charge Distribution - Employee Share', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5602', name: 'Service Charge - Asset Insurance Reserve', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5603', name: 'Service Charge - Training Fund', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5701', name: 'Depreciation - Building', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5702', name: 'Depreciation - FF&E', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
    { code: '5801', name: 'Income Tax Expense', type: 'Expense', balance: 'Debit', excludeFromOccupancy: false },
  ]

  for (const acc of accounts) {
    await pool.query(
      `
        INSERT INTO coa (code, account_name, account_type, normal_balance, exclude_from_occupancy)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (code)
        DO UPDATE SET
          account_name = EXCLUDED.account_name,
          account_type = EXCLUDED.account_type,
          normal_balance = EXCLUDED.normal_balance,
          exclude_from_occupancy = EXCLUDED.exclude_from_occupancy,
          updated_at = CURRENT_TIMESTAMP
      `,
      [acc.code, acc.name, acc.type, acc.balance, acc.excludeFromOccupancy],
    )
  }
}

async function seedPostingMappings(pool: Pool) {
  const mappings = [
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'ROOM_RATE',
      debit: '1010',
      credit: '4001',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'ROOM_SERVICE',
      debit: '1010',
      credit: '4104',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'RESTAURANT',
      debit: '1010',
      credit: '4101',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'LAUNDRY',
      debit: '1010',
      credit: '4201',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'PARKING',
      debit: '1010',
      credit: '4202',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'SPA',
      debit: '1010',
      credit: '4203',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: 'MINIBAR',
      debit: '1010',
      credit: '4205',
    },
    {
      module: 'FOLIO',
      event: 'CHARGE_POST',
      key: '*',
      debit: '1010',
      credit: '4301',
    },
    {
      module: 'NIGHT_AUDIT',
      event: 'ROOM_RATE',
      key: '*',
      debit: '1010',
      credit: '4001',
    },
    {
      module: 'AR',
      event: 'PAYMENT_RECEIVE',
      key: '*',
      debit: '1002',
      credit: '1010',
    },
  ]

  for (const row of mappings) {
    await pool.query(
      `
        INSERT INTO posting_account_mappings (
          module_code,
          event_code,
          key_code,
          debit_account_code,
          credit_account_code,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, true)
        ON CONFLICT (module_code, event_code, key_code)
        DO UPDATE SET
          debit_account_code = EXCLUDED.debit_account_code,
          credit_account_code = EXCLUDED.credit_account_code,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
      `,
      [row.module, row.event, row.key, row.debit, row.credit],
    )
  }
}

async function seedFiscalPeriods(pool: Pool) {
  const currentYear = new Date().getFullYear()
  const fyRes = await pool.query('SELECT id FROM fiscal_years WHERE year = $1 LIMIT 1', [currentYear])

  let fiscalYearId = fyRes.rows[0]?.id
  if (!fiscalYearId) {
    const created = await pool.query(
      `
        INSERT INTO fiscal_years (year, starts_on, ends_on)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
      [currentYear, `${currentYear}-01-01`, `${currentYear}-12-31`],
    )
    fiscalYearId = created.rows[0].id
  }

  for (let i = 1; i <= 12; i++) {
    const monthStart = `${currentYear}-${String(i).padStart(2, '0')}-01`
    const monthEndDate = new Date(currentYear, i, 0)
    const monthEnd = `${currentYear}-${String(i).padStart(2, '0')}-${String(monthEndDate.getDate()).padStart(2, '0')}`

    await pool.query(
      `
        INSERT INTO accounting_periods (fiscal_year_id, period_number, starts_on, ends_on, status)
        VALUES ($1, $2, $3, $4, 'OPEN')
        ON CONFLICT (fiscal_year_id, period_number) DO NOTHING
      `,
      [fiscalYearId, i, monthStart, monthEnd],
    )
  }
}

async function seedBusinessDates(pool: Pool) {
  const today = new Date().toISOString().slice(0, 10)
  const unitsRes = await pool.query('SELECT id FROM units')

  for (const unit of unitsRes.rows) {
    await pool.query(
      `
        INSERT INTO unit_business_dates (unit_id, business_date)
        VALUES ($1, $2::date)
        ON CONFLICT (unit_id) DO NOTHING
      `,
      [unit.id, today],
    )
  }
}
