import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import crypto from 'crypto';

const dbPath = path.join(app.getPath('userData'), 'app.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export default db;

export function initializeSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS piece_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_en TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('custom_wear','abaya','uniform','alteration','special')),
      active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      base_price REAL DEFAULT 0,
      UNIQUE(name_en, category)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT,
      name_en TEXT NOT NULL,
      prefix TEXT UNIQUE NOT NULL,
      last_sequence INTEGER DEFAULT 0,
      address TEXT,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','manager','reception','worker')),
      worker_type TEXT CHECK(worker_type IN ('tailor','master_cutter',NULL)),
      branch_id INTEGER REFERENCES branches(id),
      base_salary REAL DEFAULT 0,
      default_rate REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT,
      notes TEXT,
      branch_id INTEGER REFERENCES branches(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT NOT NULL UNIQUE,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      piece_type TEXT NOT NULL,
      details TEXT,
      price REAL NOT NULL,
      paid REAL DEFAULT 0,
      balance REAL GENERATED ALWAYS AS (price - paid) VIRTUAL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card')),
      status TEXT NOT NULL CHECK(status IN ('intake','cutting','sewing','ready','delivered')) DEFAULT 'intake',
      receive_date DATE,
      delivery_date DATE,
      created_by INTEGER REFERENCES users(id),
      fabric_source TEXT CHECK(fabric_source IN ('customer','shop')) DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      piece_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL DEFAULT 0,
      fabric_source TEXT CHECK(fabric_source IN ('customer','shop')) DEFAULT 'customer',
      fabric_price REAL NOT NULL DEFAULT 0,
      details TEXT,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON delete cascade,
      chest REAL,
      waist REAL,
      hips REAL,
      length REAL,
      sleeve REAL,
      shoulder REAL,
      notes TEXT,
      taken_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS customer_measurement_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      label TEXT,
      chest REAL,
      waist REAL,
      hips REAL,
      length REAL,
      sleeve REAL,
      shoulder REAL,
      notes TEXT
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE,
      task_type TEXT NOT NULL CHECK(task_type IN ('cutting','sewing','design')),
      assigned_to INTEGER REFERENCES users(id),
      wage_type TEXT NOT NULL CHECK(wage_type IN ('percentage','fixed')),
      wage_rate REAL NOT NULL,
      wage_amount REAL NOT NULL,
      task_quantity INTEGER DEFAULT 1,
      status TEXT NOT NULL CHECK(status IN ('pending','in_progress','done')) DEFAULT 'pending',
      started_at DATETIME,
      completed_at DATETIME,
      notes TEXT
    )
  `);

  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_order_tasks_item ON order_tasks(order_item_id)`); } catch { /* column may not exist yet, created in migration */ }

  db.exec(`
    CREATE TABLE IF NOT EXISTS worker_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      piece_type TEXT NOT NULL,
      wage_type TEXT NOT NULL CHECK(wage_type IN ('percentage','fixed')),
      rate REAL NOT NULL,
      season_start DATE,
      season_end DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS worker_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      amount REAL NOT NULL,
      note TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS order_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      amount REAL NOT NULL,
      method TEXT NOT NULL CHECK(method IN ('cash','card')),
      note TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER REFERENCES orders(id) UNIQUE,
      generated_at DATETIME,
      printed_at DATETIME,
      sent_via_whatsapp INTEGER DEFAULT 0
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN (
        'order_created','order_status_changed','order_overdue','payment_received','task_status_changed'
      )),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      order_id INTEGER REFERENCES orders(id),
      task_id INTEGER REFERENCES order_tasks(id),
      target_user_id INTEGER REFERENCES users(id),
      target_role TEXT CHECK(target_role IN ('admin','manager','reception','worker',NULL)),
      is_read INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(target_user_id, is_read, is_deleted, created_at DESC)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(target_role, is_read, is_deleted, created_at DESC)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK(category IN ('rent','utilities','materials','fabric','supplies','salaries','other')),
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      expense_date DATE NOT NULL,
      branch_id INTEGER REFERENCES branches(id),
      created_by INTEGER REFERENCES users(id),
      note TEXT,
      is_deleted INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS report_emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      label TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES users(id),
      production_date DATE NOT NULL,
      piece_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      wage_rate REAL NOT NULL,
      wage_amount REAL NOT NULL,
      notes TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_production_worker_date ON daily_production(worker_id, production_date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_production_date ON daily_production(production_date)`);

  const branchCount = db.prepare('SELECT COUNT(*) as count FROM branches').get() as { count: number };
  if (branchCount.count === 0) {
    seedDatabase();
  }

  // Migrations: add missing columns to existing tables FIRST
  // This must run before any queries that might reference new columns
  migrateColumns();

  // Migration: Fix plain text passwords
  migratePasswords();

  // Seed piece types if empty
  const pieceTypeCount = db.prepare('SELECT COUNT(*) as count FROM piece_types').get() as { count: number };
  if (pieceTypeCount.count === 0) {
    seedPieceTypes();
  } else {
    seedBasePrices();
  }

  // Seed default settings if empty
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };
  if (settingsCount.count === 0) {
    seedSettings();
  }

  // Migration: Ensure locale is set
  const localeSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get('locale') as { value: string } | undefined;
  if (!localeSetting) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('locale', 'en');
  }

  // Migration: Seed invoice toggle settings for existing databases
  const insertIgnoreSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  const invoiceKeys: [string, string][] = [
    ['invoice_show_shop_name', '1'],
    ['invoice_show_branch_info', '1'],
    ['invoice_show_phone', '1'],
    ['invoice_show_worker_name', '1'],
    ['invoice_show_worker_phone', '1'],
    ['invoice_show_delivery_date', '1'],
    ['invoice_show_payment_method', '1'],
    ['invoice_show_shop_logo', '1'],
    ['invoice_show_notes', '1'],
    ['invoice_header_text', ''],
    ['invoice_shop_name_ar', ''],
    ['invoice_shop_name_en', ''],
    ['invoice_section_order', '["shop_logo","shop_name","branch_info","phone","invoice_details","worker_name","items","totals","previous_balance","payment_method","dates","payment_status","notes","footer"]'],
  ];
  for (const [key, value] of invoiceKeys) {
    insertIgnoreSetting.run(key, value);
  }
  // Clean up old key from previous version
  db.prepare("DELETE FROM settings WHERE key = 'invoice_show_header'").run();

  // Migration: Seed auto-sync settings
  const autoSyncKeys: [string, string][] = [
    ['auto_sync_enabled', '0'],
    ['auto_sync_interval', '30'],
  ];
  for (const [key, value] of autoSyncKeys) {
    insertIgnoreSetting.run(key, value);
  }

  // Migration: Create licenses table
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_key TEXT UNIQUE NOT NULL,
        client_name TEXT NOT NULL,
        client_email TEXT NOT NULL,
        license_type TEXT NOT NULL CHECK(license_type IN ('trial','full','demo')),
        expiry_date DATE,
        max_branches INTEGER DEFAULT 2,
        hardware_id TEXT,
        is_active INTEGER DEFAULT 1,
        activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch { /* table already exists */ }

  // Migration: Add hardware_id column to existing licenses table
  try {
    const columns = db.prepare('PRAGMA table_info(licenses)').all() as { name: string }[];
    const hasHardwareId = columns.some((col) => col.name === 'hardware_id');
    if (!hasHardwareId) {
      console.log('Migration: adding hardware_id to licenses');
      db.exec('ALTER TABLE licenses ADD COLUMN hardware_id TEXT');
    }
  } catch { /* table might not exist yet */ }

  // Migration: Add demo mode settings
  const demoKeys: [string, string][] = [
    ['demo_mode', '0'],
    ['demo_max_orders', '50'],
    ['demo_expiry_days', '30'],
    ['license_key', ''],
    ['license_status', 'none'], // none, trial, full, expired
    ['license_expiry', ''],
  ];
  for (const [key, value] of demoKeys) {
    insertIgnoreSetting.run(key, value);
  }

  console.log('Database schema initialized successfully');
}

function migrateColumns() {
  // Clean up any stale migration temp tables
  try { db.exec('DROP TABLE IF EXISTS orders_new'); } catch { /* ignore cleanup errors */ }
  try { db.exec('DROP TABLE IF EXISTS users_new'); } catch { /* ignore cleanup errors */ }

  const tables: Record<string, string[]> = {};

  // Ensure worker_payments table exists (migration for existing DBs)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS worker_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        amount REAL NOT NULL,
        note TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch { /* table already exists */ }

  // Ensure order_payments table exists (migration for existing DBs)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        amount REAL NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('cash','card')),
        note TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch { /* table already exists */ }

  // Ensure expenses table exists (migration for existing DBs)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL CHECK(category IN ('rent','utilities','materials','fabric','supplies','salaries','other')),
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        expense_date DATE NOT NULL,
        branch_id INTEGER REFERENCES branches(id),
        created_by INTEGER REFERENCES users(id),
        note TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)`);
  } catch { /* table already exists */ }

  // Backfill: create a single order_payments row for existing orders where paid > 0 and no payment record exists
  try {
    const unpaidOrders = db.prepare(`
      SELECT id, paid, payment_method FROM orders
      WHERE paid > 0 AND id NOT IN (SELECT DISTINCT order_id FROM order_payments)
    `).all() as { id: number; paid: number; payment_method: string }[];
    if (unpaidOrders.length > 0) {
      const backfill = db.prepare(
        'INSERT INTO order_payments (order_id, amount, method, note) VALUES (?, ?, ?, ?)'
      );
      const txn = db.transaction(() => {
        for (const o of unpaidOrders) {
          backfill.run(o.id, o.paid, o.payment_method, 'Initial payment (migrated)');
        }
      });
      txn();
      console.log(`Migrated ${unpaidOrders.length} existing payment(s) to order_payments`);
    }
  } catch (e) {
    console.log('order_payments backfill skipped:', (e as Error).message);
  }

  // Get existing columns for each table
  for (const table of ['orders', 'users', 'customers', 'order_tasks', 'worker_rates', 'piece_types', 'order_items', 'branches', 'daily_production']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    tables[table] = cols.map((c) => c.name);
  }

  // ── Multi-item order migration ──
  // Create order_items table if not exists
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        piece_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL DEFAULT 0,
        fabric_source TEXT CHECK(fabric_source IN ('customer','shop')) DEFAULT 'customer',
        details TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)`);
  } catch { /* table already exists */ }

  // Add phone to branches
  if (!tables.branches?.includes('phone')) {
    console.log('Migrating: adding phone to branches');
    db.exec('ALTER TABLE branches ADD COLUMN phone TEXT');
  }

  // Add default_rate to users
  if (!tables.users?.includes('default_rate')) {
    console.log('Migrating: adding default_rate to users');
    db.exec('ALTER TABLE users ADD COLUMN default_rate REAL DEFAULT 0');
  }

  // Add branch_id to users (if missing)
  if (!tables.users?.includes('branch_id')) {
    console.log('Migrating: adding branch_id to users');
    db.exec('ALTER TABLE users ADD COLUMN branch_id INTEGER REFERENCES branches(id)');
  }

  // Add base_price to piece_types
  if (!tables.piece_types?.includes('base_price')) {
    console.log('Migrating: adding base_price to piece_types');
    db.exec('ALTER TABLE piece_types ADD COLUMN base_price REAL DEFAULT 0');
  }

  // Add fabric_source to orders
  if (!tables.orders?.includes('fabric_source')) {
    console.log('Migrating: adding fabric_source to orders');
    db.exec("ALTER TABLE orders ADD COLUMN fabric_source TEXT CHECK(fabric_source IN ('customer','shop')) DEFAULT 'customer'");
  }

  // Add fabric_price to order_items
  if (!tables.order_items?.includes('fabric_price')) {
    console.log('Migrating: adding fabric_price to order_items');
    db.exec('ALTER TABLE order_items ADD COLUMN fabric_price REAL NOT NULL DEFAULT 0');
  }

  // Add order_item_id and task_quantity to order_tasks
  if (!tables.order_tasks?.includes('order_item_id')) {
    console.log('Migrating: adding order_item_id to order_tasks');
    db.exec('ALTER TABLE order_tasks ADD COLUMN order_item_id INTEGER REFERENCES order_items(id) ON DELETE CASCADE');
  }
  if (!tables.order_tasks?.includes('task_quantity')) {
    console.log('Migrating: adding task_quantity to order_tasks');
    db.exec('ALTER TABLE order_tasks ADD COLUMN task_quantity INTEGER DEFAULT 1');
  }
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_order_tasks_item ON order_tasks(order_item_id)`); } catch { /* ignore */ }

  // Backfill order_items for existing orders
  migrateToMultiItem();

  if (!tables.orders?.includes('branch_id')) {
    console.log('Migrating: adding branch_id to orders');
    db.exec('ALTER TABLE orders ADD COLUMN branch_id INTEGER REFERENCES branches(id)');

    const defaultBranch = db.prepare('SELECT id FROM branches ORDER BY id LIMIT 1').get() as { id: number } | undefined;
    if (defaultBranch) {
      db.exec(`
        UPDATE orders
        SET branch_id = COALESCE(
          (
            SELECT customers.branch_id
            FROM customers
            WHERE customers.id = orders.customer_id
          ),
          ${defaultBranch.id}
        )
        WHERE branch_id IS NULL
      `);
    }

    tables.orders.push('branch_id');
  }

  if (!tables.orders?.includes('is_deleted')) {
    console.log('Migrating: adding is_deleted to orders');
    db.exec('ALTER TABLE orders ADD COLUMN is_deleted INTEGER DEFAULT 0');
  }

  // Add missing columns
  const migrations: [string, string, string][] = [
    ['orders', 'receive_date', 'DATE'],
    ['orders', 'delivery_date', 'DATE'],
    ['orders', 'created_by', 'INTEGER REFERENCES users(id)'],
    ['orders', 'details', 'TEXT'],
  ];

  for (const [table, column, def] of migrations) {
    if (!tables[table]?.includes(column)) {
      console.log(`Migrating: ALTER TABLE ${column} ${def}`);
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
  }

  // Migrate orders.piece_type from CHECK constraint to free text (referencing piece_types.name_en)
  // SQLite doesn't support ALTER TABLE DROP CHECK, so we recreate the table if needed
  try {
    const hasConstraint = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='orders'").get() as { sql: string } | undefined;
    if (hasConstraint?.sql?.includes("CHECK(piece_type IN")) {
      console.log('Migrating: removing piece_type CHECK constraint from orders');
      db.exec(`
        CREATE TABLE IF NOT EXISTS orders_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_number TEXT NOT NULL UNIQUE,
          branch_id INTEGER NOT NULL REFERENCES branches(id),
          customer_id INTEGER NOT NULL REFERENCES customers(id),
          piece_type TEXT NOT NULL,
          details TEXT,
          price REAL NOT NULL,
          paid REAL DEFAULT 0,
          balance REAL GENERATED ALWAYS AS (price - paid) VIRTUAL,
          payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','card')),
          status TEXT NOT NULL CHECK(status IN ('intake','cutting','sewing','ready','delivered')) DEFAULT 'intake',
          receive_date DATE,
          delivery_date DATE,
          created_by INTEGER REFERENCES users(id),
          fabric_source TEXT CHECK(fabric_source IN ('customer','shop')) DEFAULT 'customer',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`
        INSERT INTO orders_new (
          id, order_number, branch_id, customer_id, piece_type, details,
          price, paid, payment_method, status, receive_date, delivery_date,
          created_by, created_at
        )
        SELECT
          id,
          order_number,
          COALESCE(branch_id, (SELECT id FROM branches ORDER BY id LIMIT 1)),
          customer_id,
          piece_type,
          details,
          price,
          paid,
          payment_method,
          status,
          receive_date,
          delivery_date,
          created_by,
          created_at
        FROM orders
      `);
      db.exec(`DROP TABLE orders`);
      db.exec(`ALTER TABLE orders_new RENAME TO orders`);
    }
  } catch (e) {
    console.log('orders migration skipped or already applied:', (e as Error).message);
  }

  // Migrate worker_type: cutter → master_cutter, NULLify designer
  try {
    const hasOldCutter = db.prepare("SELECT COUNT(*) as count FROM users WHERE worker_type = 'cutter'").get() as { count: number };
    if (hasOldCutter.count > 0) {
      console.log('Migrating: renaming worker_type cutter → master_cutter');
      db.exec("UPDATE users SET worker_type = 'master_cutter' WHERE worker_type = 'cutter'");
    }
    const hasDesigner = db.prepare("SELECT COUNT(*) as count FROM users WHERE worker_type = 'designer'").get() as { count: number };
    if (hasDesigner.count > 0) {
      console.log('Migrating: NULLifying worker_type designer');
      db.exec("UPDATE users SET worker_type = NULL WHERE worker_type = 'designer'");
    }
  } catch (e) {
    console.log('worker_type migration skipped:', (e as Error).message);
  }

  // Migrate users table CHECK constraint if it still references old worker_type values
  try {
    const usersDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get() as { sql: string } | undefined;
    if (usersDef?.sql?.includes("'cutter'") || usersDef?.sql?.includes("'designer'")) {
      console.log('Migrating: updating users CHECK constraint for worker_type');
      db.exec(`
        CREATE TABLE IF NOT EXISTS users_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('admin','manager','reception','worker')),
          worker_type TEXT CHECK(worker_type IN ('tailor','master_cutter',NULL)),
          branch_id INTEGER REFERENCES branches(id),
          base_salary REAL DEFAULT 0,
          active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`INSERT INTO users_new SELECT * FROM users`);
      db.exec(`DROP TABLE users`);
      db.exec(`ALTER TABLE users_new RENAME TO users`);
    }
  } catch (e) {
    console.log('users constraint migration skipped:', (e as Error).message);
  }

  // Migrate customers.name to allow NULL (optional customer name)
  try {
    const customersDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='customers'").get() as { sql: string } | undefined;
    if (customersDef?.sql?.includes("name TEXT NOT NULL")) {
      console.log('Migrating: making customers.name nullable');
      db.exec(`
        CREATE TABLE IF NOT EXISTS customers_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          phone TEXT,
          notes TEXT,
          branch_id INTEGER REFERENCES branches(id),
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.exec(`INSERT INTO customers_new SELECT * FROM customers`);
      db.exec(`DROP TABLE customers`);
      db.exec(`ALTER TABLE customers_new RENAME TO customers`);
    }
  } catch (e) {
    console.log('customers nullable name migration skipped:', (e as Error).message);
  }

  // ── Daily Production table migration ──
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS daily_production (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        worker_id INTEGER NOT NULL REFERENCES users(id),
        production_date DATE NOT NULL,
        piece_type TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        wage_rate REAL NOT NULL,
        wage_amount REAL NOT NULL,
        notes TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_production_worker_date ON daily_production(worker_id, production_date)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_daily_production_date ON daily_production(production_date)`);
    console.log('Migration: daily_production table created');
  } catch (e) {
    console.log('daily_production table creation skipped:', (e as Error).message);
  }
}

function migrateToMultiItem() {
  // Check if already migrated
  const count = db.prepare('SELECT COUNT(*) as c FROM order_items').get() as { c: number };
  if (count.c > 0) return; // already done

  const orders = db.prepare('SELECT id, piece_type, price FROM orders').all() as { id: number; piece_type: string; price: number }[];
  if (orders.length === 0) return;

  const insertItem = db.prepare(
    "INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source) VALUES (?, ?, 1, ?, ?, 'customer')"
  );
  const updateTask = db.prepare(
    'UPDATE order_tasks SET order_item_id = ?, task_quantity = 1 WHERE order_id = ? AND order_item_id IS NULL'
  );

  const txn = db.transaction(() => {
    for (const order of orders) {
      const result = insertItem.run(order.id, order.piece_type, order.price, order.price);
      updateTask.run(result.lastInsertRowid, order.id);
    }
  });
  txn();
  console.log(`Migrated ${orders.length} orders to multi-item structure`);
}

function seedBasePrices() {
  // Only seed if all base_prices are 0
  const zeroCount = db.prepare('SELECT COUNT(*) as c FROM piece_types WHERE base_price = 0').get() as { c: number };
  const totalCount = db.prepare('SELECT COUNT(*) as c FROM piece_types').get() as { c: number };
  if (zeroCount.c !== totalCount.c) return; // some already set

  const updates: [number, string][] = [
    [50, 'Jalabiya (No Lining)'],
    [70, 'Jalabiya (With Lining)'],
    [80, 'Dress'],
    [120, 'Evening Dress'],
    [60, 'Casual Dress'],
    [90, 'Kaftan'],
    [40, 'Skirt'],
    [35, 'Blouse'],
    [30, 'Top'],
    [40, 'Pants'],
    [120, 'Classic Abaya'],
    [150, 'Embroidered Abaya'],
    [130, 'Open Abaya'],
    [180, 'Luxury Abaya'],
    [100, 'Daily Abaya'],
    [30, 'School Uniform (Primary)'],
    [35, 'School Uniform (Middle)'],
    [40, 'School Uniform (High School)'],
    [50, 'Staff Uniform'],
    [45, 'Nurse Uniform'],
    [50, 'Company Uniform'],
    [15, 'Shortening'],
    [15, 'Length Adjustment'],
    [15, 'Waist Adjustment'],
    [15, 'Sleeve Adjustment'],
    [10, 'Repair'],
    [10, 'Zipper Change'],
    [10, 'Button Fix'],
    [100, 'Custom Design'],
    [60, 'Embroidery Only'],
    [40, 'Fabric Stitching'],
    [50, 'Re-Stitch'],
    [200, 'Bridal Dress'],
    [40, 'Kids Wear'],
  ];

  const stmt = db.prepare('UPDATE piece_types SET base_price = ? WHERE name_en = ?');
  const txn = db.transaction(() => {
    for (const [price, name] of updates) {
      stmt.run(price, name);
    }
  });
  txn();
}

function migratePasswords() {
  const users = db.prepare('SELECT id, username, password_hash FROM users').all() as any[];

  for (const user of users) {
    // Check if password is plain text (not a 64-character hex string)
    if (user.password_hash.length !== 64 || !/^[a-f0-9]{64}$/.test(user.password_hash)) {
      console.log(`Migrating password for user: ${user.username}`);
      const hashedPassword = hashPassword(user.password_hash);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashedPassword, user.id);
    }
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function seedDatabase() {
  const insertBranch = db.prepare(
    'INSERT INTO branches (name_ar, name_en, prefix, last_sequence, address) VALUES (?, ?, ?, ?, ?)'
  );

  insertBranch.run('الميرة', 'Al Mera Branch', 'A', 0, 'أم قرن - الميرة');
  insertBranch.run('الشارع التجاري', 'Al Trade Street Branch', 'B', 0, 'أم قرن - الشارع التجاري');

  const insertUser = db.prepare(
    'INSERT INTO users (name, username, password_hash, role, worker_type, branch_id, base_salary) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );

  insertUser.run('Admin', 'admin', hashPassword('admin123'), 'admin', null, 1, 0);
}

function seedSettings() {
  const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
  insertSetting.run('locale', 'en');
  insertSetting.run('shop_name_ar', 'إتيكيت للخياطة النسائية');
  insertSetting.run('shop_name_en', 'Etiquette Tailor');
  insertSetting.run('shop_phone', '');
  insertSetting.run('currency', 'QAR');
  insertSetting.run('receipt_footer', 'Thank you for choosing Etiquette Tailor');
  insertSetting.run('tax_rate', '0');

  // Invoice component toggles (all visible by default)
  insertSetting.run('invoice_show_shop_name', '1');
  insertSetting.run('invoice_show_branch_info', '1');
  insertSetting.run('invoice_show_phone', '1');
  insertSetting.run('invoice_show_worker_name', '1');
  insertSetting.run('invoice_show_worker_phone', '1');
  insertSetting.run('invoice_show_delivery_date', '1');
  insertSetting.run('invoice_show_payment_method', '1');
  insertSetting.run('invoice_show_shop_logo', '1');
  insertSetting.run('invoice_show_notes', '1');
  insertSetting.run('invoice_header_text', '');
  insertSetting.run('invoice_shop_name_ar', '');
  insertSetting.run('invoice_shop_name_en', '');
  insertSetting.run('invoice_section_order', '["shop_logo","shop_name","branch_info","phone","invoice_details","worker_name","items","totals","previous_balance","payment_method","dates","payment_status","notes","footer"]');
}

function seedPieceTypes() {
  const insert = db.prepare(
    'INSERT INTO piece_types (name_en, name_ar, category, sort_order, base_price) VALUES (?, ?, ?, ?, ?)'
  );

  const types: [string, string, string, number, number][] = [
    // Custom Wear: name_en, name_ar, category, sort_order, base_price
    ['Jalabiya (No Lining)', 'جلابية بدون بطانة', 'custom_wear', 1, 50],
    ['Jalabiya (With Lining)', 'جلابية مع البطانة', 'custom_wear', 2, 70],
    ['Dress', 'فستان', 'custom_wear', 3, 80],
    ['Evening Dress', 'فستان سهرة', 'custom_wear', 4, 120],
    ['Casual Dress', 'فستان يومي', 'custom_wear', 5, 60],
    ['Kaftan', 'قفطان', 'custom_wear', 6, 90],
    ['Skirt', 'تنورة', 'custom_wear', 7, 40],
    ['Blouse', 'بلوزة', 'custom_wear', 8, 35],
    ['Top', 'توب', 'custom_wear', 9, 30],
    ['Pants', 'بنطلون', 'custom_wear', 10, 40],
    // Abaya
    ['Classic Abaya', 'عباية سادة', 'abaya', 11, 120],
    ['Embroidered Abaya', 'عباية مطرزة', 'abaya', 12, 150],
    ['Open Abaya', 'عباية مفتوحة', 'abaya', 13, 130],
    ['Luxury Abaya', 'عباية فخمة', 'abaya', 14, 180],
    ['Daily Abaya', 'عباية يومية', 'abaya', 15, 100],
    // Uniforms
    ['School Uniform (Primary)', 'يونفورم ابتدائي', 'uniform', 16, 30],
    ['School Uniform (Middle)', 'يونفورم إعدادي', 'uniform', 17, 35],
    ['School Uniform (High School)', 'يونفورم ثانوي', 'uniform', 18, 40],
    ['Staff Uniform', 'يونفورم موظفات', 'uniform', 19, 50],
    ['Nurse Uniform', 'يونفورم طبي', 'uniform', 20, 45],
    ['Company Uniform', 'يونفورم شركات', 'uniform', 21, 50],
    // Alterations
    ['Shortening', 'تقصير', 'alteration', 22, 15],
    ['Length Adjustment', 'تعديل طول', 'alteration', 23, 15],
    ['Waist Adjustment', 'تضييق / توسيع', 'alteration', 24, 15],
    ['Sleeve Adjustment', 'تعديل أكمام', 'alteration', 25, 15],
    ['Repair', 'إصلاح', 'alteration', 26, 10],
    ['Zipper Change', 'تغيير سحاب', 'alteration', 27, 10],
    ['Button Fix', 'تركيب أزرار', 'alteration', 28, 10],
    // Special Orders
    ['Custom Design', 'تصميم خاص', 'special', 29, 100],
    ['Embroidery Only', 'تطريز فقط', 'special', 30, 60],
    ['Fabric Stitching', 'تفصيل قماش جاهز', 'special', 31, 40],
    ['Re-Stitch', 'إعادة تفصيل', 'special', 32, 50],
    ['Bridal Dress', 'فستان عروس', 'special', 33, 200],
    ['Kids Wear', 'ملابس أطفال', 'special', 34, 40],
  ];

  const tx = db.transaction(() => {
    for (const t of types) {
      insert.run(t[0], t[1], t[2], t[3], t[4]);
    }
  });
  tx();
}
