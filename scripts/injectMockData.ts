const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Determine database path based on platform
function getDatabasePath() {
  if (process.env.DB_PATH) {
    return process.env.DB_PATH;
  }

  const platform = process.platform;
  let basePath;

  if (platform === 'darwin') {
    // macOS: ~/Library/Application Support/etiquette-tailor/app.db
    basePath = path.join(process.env.HOME || '', 'Library', 'Application Support', 'etiquette-tailor');
  } else if (platform === 'win32') {
    // Windows: %APPDATA%/etiquette-tailor/app.db
    basePath = path.join(process.env.APPDATA || '', 'etiquette-tailor');
  } else {
    // Linux: ~/.config/etiquette-tailor/app.db
    basePath = path.join(process.env.HOME || '', '.config', 'etiquette-tailor');
  }

  return path.join(basePath, 'app.db');
}

const dbPath = getDatabasePath();
console.log('📁 Attempting to open database at:', dbPath);

let db;
try {
  db = new Database(dbPath);
} catch (error) {
  console.error('❌ Failed to open database:', error.message);
  console.error('');
  console.error('Please make sure:');
  console.error('  1. The app has been run at least once to initialize the database');
  console.error('  2. The database exists at:', dbPath);
  console.error('');
  console.error('You can also specify a custom path:');
  console.error('  DB_PATH=/path/to/app.db npm run mock-data');
  process.exit(1);
}

// Helper: Hash password
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Helper: Random item from array
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Helper: Random number in range
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: Random date within range
function randomDate(start, end) {
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

// Helper: Add days to date
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

console.log('🔄 Starting mock data injection...');

// Get branches
const branches = db.prepare('SELECT id, prefix, name_en FROM branches').all();
if (branches.length === 0) {
  console.error('❌ No branches found. Please run the app first to initialize the database.');
  process.exit(1);
}

console.log(`✅ Found ${branches.length} branches:`, branches.map(b => b.name_en).join(', '));

// Get piece types
const pieceTypes = db.prepare('SELECT name_en FROM piece_types').all();
if (pieceTypes.length === 0) {
  console.error('❌ No piece types found. Please run the app first to initialize the database.');
  process.exit(1);
}

console.log(`✅ Found ${pieceTypes.length} piece types`);

// Mock data arrays
const firstNames = ['Fatima', 'Aisha', 'Maryam', 'Noura', 'Hessa', 'Amal', 'Sara', 'Latifa', 'Mona', 'Shamma'];
const lastNames = ['Al-Mansoori', 'Al-Kuwari', 'Al-Thani', 'Al-Mohannadi', 'Al-Hajri', 'Al-Marri', 'Al-Abdullah', 'Al-Sulaiti'];
const customerNames = firstNames.flatMap(fn => lastNames.map(ln => `${fn} ${ln}`));

const workerNames = [
  'Khadija Hassan', 'Amina Rahman', 'Zainab Ali', 'Ruqayyah Mohammad',
  'Asma Ahmed', 'Kaltham Abdullah', 'Mouza Khalid', 'Shaima Saleh'
];

const expenseCategories = ['rent', 'utilities', 'materials', 'fabric', 'supplies', 'other'];
const expenseDescriptions = {
  rent: ['Monthly rent - Branch A', 'Monthly rent - Branch B'],
  utilities: ['Electricity bill', 'Water bill', 'AC maintenance'],
  materials: ['Thread supplies', 'Buttons stock', 'Zippers batch'],
  fabric: ['Cotton fabric roll', 'Silk fabric batch', 'Linen fabric purchase'],
  supplies: ['Scissors set', 'Measuring tapes', 'Needle pack'],
  other: ['Delivery service', 'Packaging materials', 'Cleaning service']
};

console.log('👥 Creating mock customers...');
// Create 50 customers per branch
const customerIds = [];
for (const branch of branches) {
  for (let i = 0; i < 50; i++) {
    const name = randomItem(customerNames);
    const phone = `${randomInt(3000, 9999)} ${randomInt(10000, 99999)}`;
    const result = db.prepare(
      'INSERT INTO customers (name, phone, notes, branch_id) VALUES (?, ?, ?, ?)'
    ).run(
      name,
      phone,
      `Mock customer ${i + 1} for testing`,
      branch.id
    );
    customerIds.push(result.lastInsertRowid);
  }
}
console.log(`✅ Created ${customerIds.length} customers`);

console.log('👷 Creating mock workers...');
// Create 8 workers (4 per branch)
const workerIds = [];
const workerTypes = ['tailor', 'master_cutter'];
for (const branch of branches) {
  for (let i = 0; i < 4; i++) {
    const name = workerNames[i + (branch.id - 1) * 4];
    const username = name.toLowerCase().replace(/ /g, '.') + randomInt(1, 99);
    const workerType = randomItem(workerTypes);
    const result = db.prepare(
      'INSERT INTO users (name, username, password_hash, role, worker_type, branch_id, base_salary, default_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      name,
      username,
      hashPassword('password123'),
      'worker',
      workerType,
      branch.id,
      randomInt(3000, 5000),
      randomInt(10, 25)
    );
    const workerId = result.lastInsertRowid;
    workerIds.push({ id: workerId, branch_id: branch.id });

    // Set worker rates for common piece types
    const commonPieces = pieceTypes.slice(0, 10);
    for (const piece of commonPieces) {
      const wageType = Math.random() > 0.5 ? 'percentage' : 'fixed';
      const rate = wageType === 'percentage' ? randomInt(10, 30) : randomInt(15, 50);
      db.prepare(
        'INSERT INTO worker_rates (user_id, piece_type, wage_type, rate) VALUES (?, ?, ?, ?)'
      ).run(workerId, piece.name_en, wageType, rate);
    }
  }
}
console.log(`✅ Created ${workerIds.length} workers`);

console.log('📦 Creating mock orders...');
// Create 100 orders with dates in the last 3 months
const today = new Date();
const threeMonthsAgo = new Date(today);
threeMonthsAgo.setMonth(today.getMonth() - 3);

const statuses = ['intake', 'cutting', 'sewing', 'ready', 'delivered'];
const paymentMethods = ['cash', 'card'];
const orderIds = [];

for (let i = 0; i < 100; i++) {
  const branch = randomItem(branches);
  const customerId = randomItem(customerIds);

  // Get next order number for this branch
  const sequenceResult = db.prepare('SELECT last_sequence FROM branches WHERE id = ?').get(branch.id);
  const nextSequence = sequenceResult.last_sequence + 1;
  const orderNumber = `${branch.prefix}-${String(nextSequence).padStart(3, '0')}`;

  const receiveDate = randomDate(threeMonthsAgo, today);
  const deliveryDate = addDays(receiveDate, randomInt(7, 21));

  const pieceType = randomItem(pieceTypes).name_en;
  const price = randomInt(50, 300);
  const paid = Math.random() > 0.3 ? randomInt(Math.floor(price * 0.3), price) : 0; // 70% have some payment
  const status = randomItem(statuses);
  const paymentMethod = randomItem(paymentMethods);

  const orderResult = db.prepare(`
    INSERT INTO orders (order_number, branch_id, customer_id, piece_type, details, price, paid, payment_method, status, receive_date, delivery_date, created_by, fabric_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderNumber,
    branch.id,
    customerId,
    pieceType,
    `Custom ${pieceType.toLowerCase()} - Mock order ${i + 1}`,
    price,
    paid,
    paymentMethod,
    status,
    receiveDate,
    deliveryDate,
    1, // created by admin (id=1)
    Math.random() > 0.7 ? 'shop' : 'customer'
  );

  // Update branch sequence
  db.prepare('UPDATE branches SET last_sequence = ? WHERE id = ?').run(nextSequence, branch.id);

  const orderId = orderResult.lastInsertRowid;
  orderIds.push({ id: orderId, branch_id: branch.id });

  // Create order_item
  const itemResult = db.prepare(`
    INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    pieceType,
    1,
    price,
    price,
    Math.random() > 0.7 ? 'shop' : 'customer',
    Math.random() > 0.7 ? randomInt(20, 80) : 0,
    null
  );

  // Create order measurements
  db.prepare(`
    INSERT INTO order_measurements (order_id, chest, waist, hips, length, sleeve, shoulder, notes, taken_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    orderId,
    randomInt(80, 120),
    randomInt(60, 100),
    randomInt(90, 130),
    randomInt(50, 70),
    randomInt(40, 60),
    randomInt(35, 50),
    'Mock measurements for testing',
    randomItem(workerIds).id
  );

  // Create order_tasks (cutting and sewing)
  const workersInBranch = workerIds.filter(w => w.branch_id === branch.id);
  if (workersInBranch.length >= 2) {
    // Cutting task
    const cutter = workersInBranch.find(w => {
      const user = db.prepare('SELECT worker_type FROM users WHERE id = ?').get(w.id);
      return user?.worker_type === 'master_cutter';
    }) || randomItem(workersInBranch);

    const cutterRate = db.prepare('SELECT rate, wage_type FROM worker_rates WHERE user_id = ? AND piece_type = ?').get(cutter.id, pieceType);
    const cutterWage = cutterRate
      ? (cutterRate.wage_type === 'percentage' ? (price * cutterRate.rate / 100) : cutterRate.rate)
      : price * 0.15;

    db.prepare(`
      INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      itemResult.lastInsertRowid,
      'cutting',
      cutter.id,
      cutterRate?.wage_type || 'percentage',
      cutterRate?.rate || 15,
      cutterWage,
      1,
      status !== 'intake' ? 'done' : 'pending',
      status !== 'intake' ? receiveDate : null,
      status !== 'intake' ? receiveDate : null
    );

    // Sewing task
    const tailor = workersInBranch.find(w => {
      const user = db.prepare('SELECT worker_type FROM users WHERE id = ?').get(w.id);
      return user?.worker_type === 'tailor';
    }) || randomItem(workersInBranch.filter(w => w.id !== cutter.id));

    const tailorRate = db.prepare('SELECT rate, wage_type FROM worker_rates WHERE user_id = ? AND piece_type = ?').get(tailor.id, pieceType);
    const tailorWage = tailorRate
      ? (tailorRate.wage_type === 'percentage' ? (price * tailorRate.rate / 100) : tailorRate.rate)
      : price * 0.20;

    db.prepare(`
      INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status, started_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId,
      itemResult.lastInsertRowid,
      'sewing',
      tailor.id,
      tailorRate?.wage_type || 'percentage',
      tailorRate?.rate || 20,
      tailorWage,
      1,
      status === 'ready' || status === 'delivered' ? 'done' : status === 'sewing' ? 'in_progress' : 'pending',
      status === 'sewing' || status === 'ready' || status === 'delivered' ? receiveDate : null,
      status === 'ready' || status === 'delivered' ? addDays(receiveDate, 3) : null
    );
  }

  // Create payment record if paid > 0
  if (paid > 0) {
    db.prepare(`
      INSERT INTO order_payments (order_id, amount, method, note, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(orderId, paid, paymentMethod, 'Initial payment', 1);
  }

  // Create invoice
  if (status === 'ready' || status === 'delivered') {
    db.prepare(`
      INSERT INTO invoices (order_id, generated_at, printed_at)
      VALUES (?, ?, ?)
    `).run(orderId, receiveDate, status === 'delivered' ? receiveDate : null);
  }
}
console.log(`✅ Created ${orderIds.length} orders`);

console.log('💰 Creating mock worker payments...');
// Create worker payments for completed tasks
for (const worker of workerIds) {
  const numPayments = randomInt(2, 8);
  for (let i = 0; i < numPayments; i++) {
    const amount = randomInt(500, 3000);
    const paymentDate = randomDate(threeMonthsAgo, today);
    db.prepare(`
      INSERT INTO worker_payments (user_id, amount, note, created_by)
      VALUES (?, ?, ?, ?)
    `).run(worker.id, amount, `Salary payment ${i + 1} - Mock data`, 1);
  }
}
console.log(`✅ Created worker payments`);

console.log('📊 Creating mock expenses...');
// Create expenses for each branch
for (const branch of branches) {
  const numExpenses = randomInt(15, 30);
  for (let i = 0; i < numExpenses; i++) {
    const category = randomItem(expenseCategories);
    const descriptions = expenseDescriptions[category] || expenseDescriptions.other;
    const description = randomItem(descriptions);
    const amount = category === 'rent'
      ? randomInt(8000, 15000)
      : category === 'utilities'
      ? randomInt(500, 3000)
      : randomInt(100, 2000);
    const expenseDate = randomDate(threeMonthsAgo, today);

    db.prepare(`
      INSERT INTO expenses (category, description, amount, expense_date, branch_id, created_by, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      category,
      description,
      amount,
      expenseDate,
      branch.id,
      1,
      'Mock expense for testing'
    );
  }
}
console.log(`✅ Created expenses`);

console.log('📋 Creating mock daily production records...');
// Create daily production for workers
const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);

for (const worker of workerIds) {
  const numEntries = randomInt(5, 15);
  for (let i = 0; i < numEntries; i++) {
    const productionDate = randomDate(threeMonthsAgo, yesterday);
    const pieceType = randomItem(pieceTypes).name_en;
    const quantity = randomInt(1, 5);
    const wageRate = randomInt(15, 35);
    const wageAmount = quantity * wageRate;

    db.prepare(`
      INSERT INTO daily_production (worker_id, production_date, piece_type, quantity, wage_rate, wage_amount, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      worker.id,
      productionDate,
      pieceType,
      quantity,
      wageRate,
      wageAmount,
      'Mock production entry',
      1
    );
  }
}
console.log(`✅ Created daily production records`);

console.log('');
console.log('✨ Mock data injection completed successfully!');
console.log('');
console.log('📊 Summary:');
console.log(`   - ${customerIds.length} customers created`);
console.log(`   - ${workerIds.length} workers created`);
console.log(`   - ${orderIds.length} orders created`);
console.log(`   - Expenses created for ${branches.length} branches`);
console.log(`   - Daily production records created`);
console.log('');
console.log('🔐 Test Credentials:');
workerIds.forEach((w, idx) => {
  const worker = db.prepare('SELECT name, username FROM users WHERE id = ?').get(w.id);
  console.log(`   Worker ${idx + 1}: ${worker.name}`);
  console.log(`   Username: ${worker.username}`);
  console.log(`   Password: password123`);
  console.log('');
});
console.log('   Admin: admin');
console.log('   Password: admin123');
console.log('');

db.close();
