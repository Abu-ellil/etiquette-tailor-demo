import db from './connection';

export interface Order {
  id?: number;
  order_number: string;
  branch_id: number;
  customer_id: number;
  piece_type: string;
  details?: string;
  price: number;
  paid: number;
  balance: number;
  payment_method: 'cash' | 'card';
  status: 'intake' | 'cutting' | 'sewing' | 'ready' | 'delivered';
  receive_date?: string;
  delivery_date?: string;
  created_by?: number;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  branch_name?: string;
  branch_name_ar?: string;
  branch_prefix?: string;
  branch_phone?: string;
  branch_address?: string;
  is_deleted?: number;
}

export interface OrderMeasurement {
  id?: number;
  order_id: number;
  chest?: number;
  waist?: number;
  hips?: number;
  length?: number;
  sleeve?: number;
  shoulder?: number;
  notes?: string;
  taken_by?: number;
  created_at?: string;
}

export interface OrderTask {
  id?: number;
  order_id: number;
  order_item_id?: number;
  task_type: 'cutting' | 'sewing' | 'design';
  assigned_to?: number;
  wage_type: 'percentage' | 'fixed';
  wage_rate: number;
  wage_amount: number;
  task_quantity?: number;
  status: 'pending' | 'in_progress' | 'done';
  started_at?: string;
  completed_at?: string;
  notes?: string;
  worker_name?: string;
  // Joined fields from order_items
  item_piece_type?: string;
  base_price?: number;
}

function generateOrderNumber(branchId: number): string {
  const branch = db.prepare('SELECT prefix, last_sequence FROM branches WHERE id = ?').get(branchId) as { prefix: string; last_sequence: number };
  if (!branch) throw new Error('Branch not found');

  const nextSeq = branch.last_sequence + 1;

  const updateSeq = db.prepare('UPDATE branches SET last_sequence = ? WHERE id = ?');
  updateSeq.run(nextSeq, branchId);

  return `${branch.prefix}-${String(nextSeq).padStart(3, '0')}`;
}

// ── Order Items ────────────────────────────────────────────────────

export interface OrderItem {
  id?: number;
  order_id: number;
  piece_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  fabric_source: 'customer' | 'shop';
  fabric_price?: number;
  details?: string;
  sort_order?: number;
  created_at?: string;
  // Joined fields
  base_price?: number;
  name_ar?: string;
}

export function getOrderItems(orderId: number): OrderItem[] {
  const stmt = db.prepare(`
    SELECT oi.*, pt.base_price, pt.name_ar
    FROM order_items oi
    LEFT JOIN piece_types pt ON oi.piece_type = pt.name_en
    WHERE oi.order_id = ?
    ORDER BY oi.sort_order
  `);
  return stmt.all(orderId) as OrderItem[];
}

export function createOrderItem(item: Omit<OrderItem, 'id'>): number {
  const fabricPrice = item.fabric_price || 0;
  const lineTotal = (item.unit_price * item.quantity) + (fabricPrice * item.quantity);
  const stmt = db.prepare(`
    INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    item.order_id,
    item.piece_type,
    item.quantity,
    item.unit_price,
    item.total_price || lineTotal,
    item.fabric_source || 'customer',
    fabricPrice,
    item.details || null,
    item.sort_order || 0
  );
  recalculateOrderTotal(item.order_id);
  return result.lastInsertRowid as number;
}

export function updateOrderItem(id: number, data: Partial<OrderItem>): void {
  const fabricPrice = data.fabric_price || 0;
  const lineTotal = (data.unit_price! * data.quantity!) + (fabricPrice * data.quantity!);
  const stmt = db.prepare(`
    UPDATE order_items SET
      piece_type = ?, quantity = ?, unit_price = ?,
      total_price = ?, fabric_source = ?, fabric_price = ?, details = ?
    WHERE id = ?
  `);
  stmt.run(
    data.piece_type,
    data.quantity,
    data.unit_price,
    data.total_price || lineTotal,
    data.fabric_source || 'customer',
    fabricPrice,
    data.details || null,
    id
  );
  // Recalculate order total after item update
  const row = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(id) as { order_id: number } | undefined;
  if (row) recalculateOrderTotal(row.order_id);
}

export function deleteOrderItem(id: number): void {
  const row = db.prepare('SELECT order_id FROM order_items WHERE id = ?').get(id) as { order_id: number } | undefined;
  db.prepare('DELETE FROM order_items WHERE id = ?').run(id);
  if (row) recalculateOrderTotal(row.order_id);
}

export function recalculateOrderTotal(orderId: number): void {
  const sum = db.prepare(
    'SELECT COALESCE(SUM(total_price), 0) as total FROM order_items WHERE order_id = ?'
  ).get(orderId) as { total: number };
  db.prepare('UPDATE orders SET price = ? WHERE id = ?').run(sum.total, orderId);
}

export function getAllOrders(branchId?: number, status?: string): Order[] {
  let query = `
    SELECT o.*, c.name as customer_name, c.phone as customer_phone,
      COALESCE(ps.paid_sum, 0) as paid,
      b.name_en as branch_name, b.name_ar as branch_name_ar, b.prefix as branch_prefix, b.phone as branch_phone, b.address as branch_address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN (SELECT order_id, SUM(amount) as paid_sum FROM order_payments GROUP BY order_id) ps ON ps.order_id = o.id
    LEFT JOIN branches b ON o.branch_id = b.id
  WHERE o.is_deleted = 0
  `;
  const params: any[] = [];

  if (branchId) {
    query += ' AND o.branch_id = ?';
    params.push(branchId);
  }
  if (status) {
    query += ' AND o.status = ?';
    params.push(status);
  }
  query += ' ORDER BY o.created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as Order[];
}

export function getOrder(id: number): Order | undefined {
  // Sync paid from actual payment records before returning
  db.prepare(`
    UPDATE orders SET paid = COALESCE((SELECT SUM(amount) FROM order_payments WHERE order_id = ?), 0)
    WHERE id = ?
  `).run(id, id);
  const stmt = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone,
      b.name_en as branch_name, b.name_ar as branch_name_ar, b.prefix as branch_prefix, b.phone as branch_phone, b.address as branch_address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN branches b ON o.branch_id = b.id
    WHERE o.id = ? AND o.is_deleted = 0
  `);
  return stmt.get(id) as Order | undefined;
}

export function getOrderByNumber(orderNumber: string): Order | undefined {
  const stmt = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.order_number = ? AND o.is_deleted = 0
  `);
  return stmt.get(orderNumber) as Order | undefined;
}

export function createOrder(order: Omit<Order, 'id' | 'balance'>, measurements?: OrderMeasurement, items?: Omit<OrderItem, 'id' | 'order_id'>[]): number {
  const transaction = db.transaction(() => {
    const orderNumber = order.order_number?.trim() || generateOrderNumber(order.branch_id);

    // Calculate total from items if provided
    const totalPrice = items && items.length > 0
      ? items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0)
      : order.price;

    // Get primary piece_type from first item if provided
    const primaryPieceType = items && items.length > 0 ? items[0].piece_type : order.piece_type;

    const orderStmt = db.prepare(`
      INSERT INTO orders (
        order_number, branch_id, customer_id, piece_type, details,
        price, paid, payment_method, status, receive_date, delivery_date, created_by, fabric_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = orderStmt.run(
      orderNumber,
      order.branch_id,
      order.customer_id,
      primaryPieceType,
      order.details || null,
      totalPrice,
      order.paid || 0,
      order.payment_method,
      order.status || 'intake',
      order.receive_date || null,
      order.delivery_date || null,
      order.created_by || null,
      (items && items.length > 0) ? items[0].fabric_source || 'customer' : 'customer'
    );

    const orderId = result.lastInsertRowid as number;

    // Insert order items
    if (items && items.length > 0) {
      const itemStmt = db.prepare(`
        INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const fabricPrice = item.fabric_price || 0;
        itemStmt.run(
          orderId,
          item.piece_type,
          item.quantity,
          item.unit_price,
          (item.unit_price * item.quantity) + (fabricPrice * item.quantity),
          item.fabric_source || 'customer',
          fabricPrice,
          item.details || null,
          i
        );
      }
    }

    if (measurements) {
      const measStmt = db.prepare(`
        INSERT INTO order_measurements (order_id, chest, waist, hips, length, sleeve, shoulder, notes, taken_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      measStmt.run(
        orderId,
        measurements.chest || null,
        measurements.waist || null,
        measurements.hips || null,
        measurements.length || null,
        measurements.sleeve || null,
        measurements.shoulder || null,
        measurements.notes || null,
        measurements.taken_by || null
      );
    }

    return orderId;
  });

  return transaction();
}

export interface WorkflowPayload {
  branch_id: number;
  customer_id: number;
  created_by: number;
  payment_method: 'cash' | 'card';
  delivery_date: string;
  receive_date?: string;
  fabric_source?: 'customer' | 'shop';
  notes?: string;
  items: {
    piece_type: string;
    quantity: number;
    unit_price: number;
    fabric_source?: 'customer' | 'shop';
    fabric_price?: number;
    details?: string;
    cutter_id?: number;
    cutter_wage_type?: 'percentage' | 'fixed';
    cutter_wage_rate?: number;
    tailors?: {
      worker_id: number;
      quantity: number;
      wage_type: 'percentage' | 'fixed';
      wage_rate: number;
    }[];
  }[];
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    length?: number;
    sleeve?: number;
    shoulder?: number;
    notes?: string;
  };
  initial_payment?: {
    amount: number;
    method: 'cash' | 'card';
    note?: string;
  };
}

export function createOrderWithTasks(payload: WorkflowPayload): { orderId: number; orderNumber: string } {
  const result = db.transaction(() => {
    const orderNumber = generateOrderNumber(payload.branch_id);
    const totalPrice = payload.items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

    db.prepare(`
      INSERT INTO orders (order_number, branch_id, customer_id, piece_type, details, price, paid, payment_method, status, receive_date, delivery_date, created_by, fabric_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intake', ?, ?, ?, ?)
    `).run(
      orderNumber,
      payload.branch_id,
      payload.customer_id,
      payload.items[0].piece_type,
      payload.notes || null,
      totalPrice,
      payload.initial_payment?.amount || 0,
      payload.payment_method,
      payload.receive_date || new Date().toISOString().split('T')[0],
      payload.delivery_date,
      payload.created_by,
      payload.fabric_source || 'customer'
    );

    const orderId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    if (payload.measurements) {
      const m = payload.measurements;
      db.prepare(`
        INSERT INTO order_measurements (order_id, chest, waist, hips, length, sleeve, shoulder, notes, taken_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orderId, m.chest || null, m.waist || null, m.hips || null, m.length || null, m.sleeve || null, m.shoulder || null, m.notes || null, payload.created_by);
    }

    for (const item of payload.items) {
      const itemTotal = item.unit_price * item.quantity;
      db.prepare(`
        INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, item.piece_type, item.quantity, item.unit_price, itemTotal,
        item.fabric_source || 'customer', item.fabric_price || 0, item.details || null
      );
      const itemId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      if (item.cutter_id && item.cutter_wage_type && item.cutter_wage_rate !== undefined) {
        const wageAmount = item.cutter_wage_type === 'percentage'
          ? (itemTotal * item.cutter_wage_rate / 100)
          : item.cutter_wage_rate;
        db.prepare(`
          INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status)
          VALUES (?, ?, 'cutting', ?, ?, ?, ?, ?, 'pending')
        `).run(orderId, itemId, item.cutter_id, item.cutter_wage_type, item.cutter_wage_rate, wageAmount, 1);
      }

      if (item.tailors && item.tailors.length > 0) {
        for (const t of item.tailors) {
          const wageAmount = t.wage_type === 'percentage'
            ? (item.unit_price * t.quantity * t.wage_rate / 100)
            : t.wage_rate;
          db.prepare(`
            INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status)
            VALUES (?, ?, 'sewing', ?, ?, ?, ?, ?, 'pending')
          `).run(orderId, itemId, t.worker_id, t.wage_type, t.wage_rate, wageAmount, t.quantity);
        }
      }
    }

    if (payload.initial_payment && payload.initial_payment.amount > 0) {
      db.prepare(`
        INSERT INTO order_payments (order_id, amount, method, note, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, payload.initial_payment.amount, payload.initial_payment.method, payload.initial_payment.note || 'Initial payment', payload.created_by);
    }

    return { orderId, orderNumber };
  })();

  return result;
}

export function updateOrder(id: number, order: Partial<Order>): void {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as Record<string, any> | undefined;
  if (!existing) throw new Error('Order not found');

  const fields: string[] = [];
  const values: any[] = [];

  const setField = (col: string) => {
    if (col in order) {
      fields.push(`${col} = ?`);
      values.push((order as any)[col]);
    }
  };

  setField('branch_id');
  setField('customer_id');
  setField('piece_type');
  setField('details');
  setField('price');
  setField('paid');
  setField('payment_method');
  setField('status');
  setField('delivery_date');
  setField('receive_date');
  setField('fabric_source');
  setField('created_by');
  setField('is_deleted');

  if (fields.length === 0) return;

  values.push(id);
  const stmt = db.prepare(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);
}

export function updateOrderStatus(id: number, status: string): void {
  if (status === 'delivered') {
    const order = db.prepare('SELECT price, paid FROM orders WHERE id = ?').get(id) as { price: number; paid: number } | undefined;
    if (!order) throw new Error('Order not found');
    if (order.paid < order.price) {
      throw new Error(`Cannot deliver: balance outstanding (${(order.price - order.paid).toFixed(2)} QAR remaining)`);
    }
  }
  const stmt = db.prepare('UPDATE orders SET status = ? WHERE id = ?');
  stmt.run(status, id);
}

export function deleteOrder(id: number): void {
  const stmt = db.prepare('DELETE FROM orders WHERE id = ?');
  stmt.run(id);
}

export function getOrderMeasurements(orderId: number): OrderMeasurement | undefined {
  const stmt = db.prepare('SELECT * FROM order_measurements WHERE order_id = ?');
  return stmt.get(orderId) as OrderMeasurement | undefined;
}

export function updateOrderMeasurements(orderId: number, measurements: Partial<OrderMeasurement>): void {
  const stmt = db.prepare(`
    UPDATE order_measurements SET
      chest = ?, waist = ?, hips = ?, length = ?,
      sleeve = ?, shoulder = ?, notes = ?
    WHERE order_id = ?
  `);
  stmt.run(
    measurements.chest || null,
    measurements.waist || null,
    measurements.hips || null,
    measurements.length || null,
    measurements.sleeve || null,
    measurements.shoulder || null,
    measurements.notes || null,
    orderId
  );
}

export function getOrderTasks(orderId: number): OrderTask[] {
  const stmt = db.prepare(`
    SELECT ot.*, u.name as worker_name,
      oi.piece_type as item_piece_type,
      pt.base_price
    FROM order_tasks ot
    LEFT JOIN users u ON ot.assigned_to = u.id
    LEFT JOIN order_items oi ON ot.order_item_id = oi.id
    LEFT JOIN piece_types pt ON oi.piece_type = pt.name_en
    WHERE ot.order_id = ?
    ORDER BY ot.task_type
  `);
  return stmt.all(orderId) as OrderTask[];
}

export function createOrderTask(task: Omit<OrderTask, 'id'>): number {
  const stmt = db.prepare(`
    INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    task.order_id,
    (task as any).order_item_id || null,
    task.task_type,
    task.assigned_to || null,
    task.wage_type,
    task.wage_rate,
    task.wage_amount,
    (task as any).task_quantity || 1,
    task.status || 'pending',
    task.notes || null
  );
  return result.lastInsertRowid as number;
}

export function updateTaskStatus(taskId: number, status: string): void {
  const now = new Date().toISOString();
  if (status === 'in_progress') {
    const stmt = db.prepare('UPDATE order_tasks SET status = ?, started_at = ? WHERE id = ?');
    stmt.run(status, now, taskId);
  } else if (status === 'done') {
    const stmt = db.prepare('UPDATE order_tasks SET status = ?, completed_at = ? WHERE id = ?');
    stmt.run(status, now, taskId);
  } else {
    const stmt = db.prepare('UPDATE order_tasks SET status = ? WHERE id = ?');
    stmt.run(status, taskId);
  }
}

export function reassignTask(taskId: number, newUserId: number, wageType: string, wageRate: number, wageAmount: number): void {
  const stmt = db.prepare(`
    UPDATE order_tasks SET assigned_to = ?, wage_type = ?, wage_rate = ?, wage_amount = ?, status = 'pending', started_at = NULL, completed_at = NULL
    WHERE id = ?
  `);
  stmt.run(newUserId, wageType, wageRate, wageAmount, taskId);
}

export function searchOrders(query: string, branchId?: number): Order[] {
  const searchTerm = `%${query}%`;
  let sql = `
    SELECT o.*, c.name as customer_name, c.phone as customer_phone,
      b.name_en as branch_name, b.name_ar as branch_name_ar, b.prefix as branch_prefix, b.phone as branch_phone, b.address as branch_address
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN branches b ON o.branch_id = b.id
    WHERE o.is_deleted = 0 AND (o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)
  `;
  const params: any[] = [searchTerm, searchTerm, searchTerm];

  if (branchId) {
    sql += ' AND o.branch_id = ?';
    params.push(branchId);
  }
  sql += ' ORDER BY o.created_at DESC';

  const stmt = db.prepare(sql);
  return stmt.all(...params) as Order[];
}

export interface TaskBoardItem {
  task_id: number;
  order_id: number;
  order_number: string;
  customer_name: string;
  piece_type: string;
  details?: string;
  task_type: string;
  assigned_to?: number;
  worker_name?: string;
  wage_type?: string;
  wage_rate?: number;
  wage_amount?: number;
  task_quantity?: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
  branch_id: number;
  order_price?: number;
  order_status?: string;
  notes?: string;
  order_item_id?: number;
  base_price?: number;
}

export function getAllTasks(filters?: { branchId?: number; workerId?: number; taskType?: string }): TaskBoardItem[] {
  let query = `
    SELECT
      ot.id as task_id,
      ot.order_id,
      o.order_number,
      c.name as customer_name,
      COALESCE(oi.piece_type, o.piece_type) as piece_type,
      COALESCE(oi.details, o.details) as details,
      ot.task_type,
      ot.assigned_to,
      u.name as worker_name,
      ot.wage_type,
      ot.wage_rate,
      ot.wage_amount,
      COALESCE(ot.task_quantity, 1) as task_quantity,
      ot.order_item_id,
      pt.base_price,
      ot.status,
      ot.started_at,
      ot.completed_at,
      o.delivery_date as due_date,
      o.branch_id,
      o.price as order_price,
      o.status as order_status,
      ot.notes
    FROM order_tasks ot
    JOIN orders o ON ot.order_id = o.id
    LEFT JOIN order_items oi ON ot.order_item_id = oi.id
    LEFT JOIN piece_types pt ON oi.piece_type = pt.name_en
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN users u ON ot.assigned_to = u.id
    WHERE o.is_deleted = 0
  `;
  const params: any[] = [];

  if (filters?.branchId) {
    query += ' AND o.branch_id = ?';
    params.push(filters.branchId);
  }
  if (filters?.workerId) {
    query += ' AND ot.assigned_to = ?';
    params.push(filters.workerId);
  }
  if (filters?.taskType) {
    query += ' AND ot.task_type = ?';
    params.push(filters.taskType);
  }

  query += ` ORDER BY
    CASE ot.status
      WHEN 'in_progress' THEN 0
      WHEN 'pending' THEN 1
      WHEN 'done' THEN 2
    END,
    o.delivery_date ASC
  `;

  const stmt = db.prepare(query);
  return stmt.all(...params) as TaskBoardItem[];
}

export function getOrderStats(branchId?: number): { total: number; in_progress: number; ready: number; delivered: number; overdue: number; revenue: number } {
  let branchFilter = '';
  const params: any[] = [];

  if (branchId) {
    branchFilter = ' AND branch_id = ?';
    params.push(branchId);
  }

  const today = new Date().toISOString().split('T')[0];

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status IN ('intake','cutting','sewing') THEN 1 ELSE 0 END), 0) as in_progress,
      COALESCE(SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END), 0) as ready,
      COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) as delivered,
      COALESCE(SUM(CASE WHEN status != 'delivered' AND delivery_date < ? THEN 1 ELSE 0 END), 0) as overdue,
      COALESCE(SUM(CASE WHEN status != 'delivered' THEN price ELSE 0 END), 0) as revenue
    FROM orders
    WHERE is_deleted = 0 ${branchFilter}
  `);
  return stmt.get(today, ...params) as { total: number; in_progress: number; ready: number; delivered: number; overdue: number; revenue: number };
}

export interface ReportStats {
  totalOrders: number;
  revenue: number;
  workersCost: number;
  netProfit: number;
}

function getPeriodDateFilter(period?: string): { filter: string; params: any[] } {
  if (!period || period === 'monthly') {
    return { filter: " AND created_at >= date('now', 'start of month')", params: [] };
  }
  if (period === 'daily') {
    return { filter: " AND date(created_at) = date('now')", params: [] };
  }
  if (period === 'weekly') {
    return { filter: " AND created_at >= date('now', '-7 days')", params: [] };
  }
  return { filter: '', params: [] };
}

export function getReportStats(branchId?: number, period?: string): ReportStats {
  let branchFilter = '';
  const params: any[] = [];

  if (branchId) {
    branchFilter = ' AND branch_id = ?';
    params.push(branchId);
  }

  const { filter: dateFilter } = getPeriodDateFilter(period);

  const stmt = db.prepare(`
    SELECT
      COUNT(*) as totalOrders,
      COALESCE(SUM(price), 0) as revenue
    FROM orders
    WHERE is_deleted = 0 ${branchFilter}${dateFilter}
  `);
  const orderStats = stmt.get(...params) as { totalOrders: number; revenue: number };

  // Workers cost = sum of all task wages
  let costFilter = '';
  const costParams: any[] = [];
  if (branchId) {
    costFilter = ' AND o.branch_id = ?';
    costParams.push(branchId);
  }

  const costDateFilter = dateFilter.replace(/created_at/g, 'o.created_at');

  const costStmt = db.prepare(`
    SELECT COALESCE(SUM(ot.wage_amount), 0) as workersCost
    FROM order_tasks ot
    JOIN orders o ON ot.order_id = o.id
    WHERE o.is_deleted = 0 ${costFilter}${costDateFilter}
  `);
  const costResult = costStmt.get(...costParams) as { workersCost: number };

  return {
    totalOrders: orderStats.totalOrders,
    revenue: orderStats.revenue,
    workersCost: costResult.workersCost,
    netProfit: orderStats.revenue - costResult.workersCost,
  };
}

export interface PaymentSplit {
  card: number;
  cash: number;
  cardAmount: number;
  cashAmount: number;
}

export function getPaymentSplit(branchId?: number, period?: string): PaymentSplit {
  let branchFilter = '';
  const params: any[] = [];

  if (branchId) {
    branchFilter = ' AND branch_id = ?';
    params.push(branchId);
  }

  const { filter: dateFilter } = getPeriodDateFilter(period);

  const stmt = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN price ELSE 0 END), 0) as cardAmount,
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN price ELSE 0 END), 0) as cashAmount,
      COUNT(*) as total
    FROM orders
    WHERE is_deleted = 0 ${branchFilter}${dateFilter}
  `);
  const result = stmt.get(...params) as { cardAmount: number; cashAmount: number; total: number };

  const total = result.cardAmount + result.cashAmount;
  return {
    card: total > 0 ? Math.round((result.cardAmount / total) * 100) : 0,
    cash: total > 0 ? Math.round((result.cashAmount / total) * 100) : 0,
    cardAmount: result.cardAmount,
    cashAmount: result.cashAmount,
  };
}

export interface MonthlyRevenue {
  month: string;
  value: number;
}

export function getMonthlyRevenue(months: number = 6, branchId?: number): MonthlyRevenue[] {
  let branchFilter = '';
  const params: any[] = [];

  if (branchId) {
    branchFilter = ' AND branch_id = ?';
    params.push(branchId);
  }

  const stmt = db.prepare(`
    SELECT
      strftime('%Y-%m', created_at) as month_key,
      COALESCE(SUM(price), 0) as value
    FROM orders
    WHERE is_deleted = 0 AND created_at >= date('now', '-${months} months') ${branchFilter}
    GROUP BY strftime('%Y-%m', created_at)
    ORDER BY month_key ASC
  `);
  const rows = stmt.all(...params) as { month_key: string; value: number }[];

  return rows.map((r) => {
    const d = new Date(r.month_key + '-01');
    const monthLabel = d.toLocaleDateString('en', { month: 'short' });
    return { month: monthLabel, value: r.value };
  });
}

export function getRecentOrders(limit: number = 10, branchId?: number, period?: string): any[] {
  let branchFilter = '';
  const params: any[] = [];

  if (branchId) {
    branchFilter = ' AND o.branch_id = ?';
    params.push(branchId);
  }

  const { filter: dateFilter } = getPeriodDateFilter(period);
  const orderDateFilter = dateFilter.replace(/created_at/g, 'o.created_at');

  const stmt = db.prepare(`
    SELECT o.*, c.name as customer_name
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.is_deleted = 0 ${branchFilter}${orderDateFilter}
    ORDER BY o.created_at DESC
    LIMIT ?
  `);

  params.push(limit);
  return (stmt as any).all(...params) as any[];
}

// ── Order Payments ──────────────────────────────────────────────────

export interface OrderPayment {
  id: number;
  order_id: number;
  amount: number;
  method: 'cash' | 'card';
  note: string | null;
  created_by: number | null;
  created_at: string;
}

export function addOrderPayment(orderId: number, amount: number, method: 'cash' | 'card', note: string | null, createdBy: number | null): number {
  const txn = db.transaction(() => {
    const insertStmt = db.prepare(
      'INSERT INTO order_payments (order_id, amount, method, note, created_by) VALUES (?, ?, ?, ?, ?)'
    );
    const result = insertStmt.run(orderId, amount, method, note, createdBy);

    // Recalculate total paid from all payment records
    const sumRow = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM order_payments WHERE order_id = ?'
    ).get(orderId) as { total: number };

    db.prepare('UPDATE orders SET paid = ? WHERE id = ?').run(sumRow.total, orderId);

    return result.lastInsertRowid as number;
  });

  return txn();
}

export function getOrderPayments(orderId: number): OrderPayment[] {
  const stmt = db.prepare(
    'SELECT * FROM order_payments WHERE order_id = ? ORDER BY created_at ASC'
  );
  return stmt.all(orderId) as OrderPayment[];
}

export function deleteOrderPayment(paymentId: number): void {
  const txn = db.transaction(() => {
    const payment = db.prepare('SELECT order_id FROM order_payments WHERE id = ?').get(paymentId) as { order_id: number } | undefined;
    if (!payment) return;

    db.prepare('DELETE FROM order_payments WHERE id = ?').run(paymentId);

    // Recalculate total paid
    const sumRow = db.prepare(
      'SELECT COALESCE(SUM(amount), 0) as total FROM order_payments WHERE order_id = ?'
    ).get(payment.order_id) as { total: number };

    db.prepare('UPDATE orders SET paid = ? WHERE id = ?').run(sumRow.total, payment.order_id);
  });

  txn();
}

// Sync all orders' paid column from actual payment records
export function syncAllOrderPayments(): void {
  db.prepare(`
    UPDATE orders SET paid = COALESCE((SELECT SUM(op.amount) FROM order_payments op WHERE op.order_id = orders.id), 0)
  `).run();
}

// ── Advanced Reports ──────────────────────────────────────────────────

export interface AdvancedReportFilter {
  branchId?: number;
  startDate?: string;
  endDate?: string;
  workerId?: number;
  status?: string;
}

export interface WorkerPerformance {
  worker_id: number;
  worker_name: string;
  order_count: number;
  percentage: number;
  revenue: number;
}

export interface AdvancedReportData {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  workerPerformance: WorkerPerformance[];
  orders: any[];
}

export function getAdvancedReport(filter: AdvancedReportFilter): AdvancedReportData {
  let where = 'WHERE o.is_deleted = 0';
  const params: any[] = [];

  if (filter.branchId) {
    where += ' AND o.branch_id = ?';
    params.push(filter.branchId);
  }
  if (filter.startDate) {
    where += ' AND date(o.created_at) >= ?';
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    where += ' AND date(o.created_at) <= ?';
    params.push(filter.endDate);
  }
  if (filter.status) {
    where += ' AND o.status = ?';
    params.push(filter.status);
  }

  const summary = db.prepare(`
    SELECT
      COUNT(*) as totalOrders,
      COALESCE(SUM(o.price), 0) as totalRevenue,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('delivered') THEN 1 ELSE 0 END), 0) as pendingOrders,
      COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END), 0) as completedOrders
    FROM orders o
    ${where}
  `).get(...params) as any;

  let workerWhere = '';
  const workerParams: any[] = [];
  if (filter.branchId) { workerWhere += ' AND o.branch_id = ?'; workerParams.push(filter.branchId); }
  if (filter.startDate) { workerWhere += ' AND date(o.created_at) >= ?'; workerParams.push(filter.startDate); }
  if (filter.endDate) { workerWhere += ' AND date(o.created_at) <= ?'; workerParams.push(filter.endDate); }
  if (filter.workerId) { workerWhere += ' AND ot.assigned_to = ?'; workerParams.push(filter.workerId); }

  const workers = db.prepare(`
    SELECT
      u.id as worker_id,
      u.name as worker_name,
      COUNT(DISTINCT o.id) as order_count,
      COALESCE(SUM(o.price), 0) as revenue
    FROM order_tasks ot
    JOIN orders o ON ot.order_id = o.id
    JOIN users u ON ot.assigned_to = u.id
    WHERE o.is_deleted = 0 ${workerWhere}
    GROUP BY u.id, u.name
    ORDER BY order_count DESC
  `).all(...workerParams) as { worker_id: number; worker_name: string; order_count: number; revenue: number }[];

  const totalWorkerOrders = workers.reduce((s, w) => s + w.order_count, 0);
  const workerPerformance: WorkerPerformance[] = workers.map(w => ({
    ...w,
    percentage: totalWorkerOrders > 0 ? Math.round((w.order_count / totalWorkerOrders) * 100) : 0,
  }));

  const orderFilter = filter.workerId
    ? ` AND o.id IN (SELECT DISTINCT order_id FROM order_tasks WHERE assigned_to = ${filter.workerId})`
    : '';
  const orders = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    ${where}${orderFilter}
    ORDER BY o.created_at DESC
  `).all(...params) as any[];

  return {
    totalOrders: summary.totalOrders || 0,
    totalRevenue: summary.totalRevenue || 0,
    pendingOrders: summary.pendingOrders || 0,
    completedOrders: summary.completedOrders || 0,
    workerPerformance,
    orders,
  };
}

export interface DailyStat {
  date: string;
  orders: number;
  revenue: number;
}

export function getDailyStats(days: number, branchId?: number): DailyStat[] {
  const branchFilter = branchId ? ' AND branch_id = ?' : '';
  const params = branchId ? [branchId] : [];

  const rows = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) as orders,
      COALESCE(SUM(price), 0) as revenue
    FROM orders
    WHERE is_deleted = 0 AND date(created_at) >= date('now', '-${days} days')${branchFilter}
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(...params) as { date: string; orders: number; revenue: number }[];

  return rows;
}

export interface WorkerContribution {
  worker_name: string;
  task_count: number;
  wage_total: number;
}

export function getWorkerContribution(branchId?: number, startDate?: string, endDate?: string): WorkerContribution[] {
  let filter = '';
  const params: any[] = [];
  if (branchId) { filter += ' AND o.branch_id = ?'; params.push(branchId); }
  if (startDate) { filter += ' AND date(o.created_at) >= ?'; params.push(startDate); }
  if (endDate) { filter += ' AND date(o.created_at) <= ?'; params.push(endDate); }

  return db.prepare(`
    SELECT
      u.name as worker_name,
      COUNT(*) as task_count,
      COALESCE(SUM(ot.wage_amount), 0) as wage_total
    FROM order_tasks ot
    JOIN orders o ON ot.order_id = o.id
    JOIN users u ON ot.assigned_to = u.id
    WHERE o.is_deleted = 0${filter}
    GROUP BY u.id, u.name
    ORDER BY task_count DESC
  `).all(...params) as WorkerContribution[];
}

export function saveReportEmail(email: string, label?: string): number {
  const existing = db.prepare('SELECT id FROM report_emails WHERE email = ?').get(email) as { id: number } | undefined;
  if (existing) return existing.id;
  const result = db.prepare('INSERT INTO report_emails (email, label) VALUES (?, ?)').run(email, label || null);
  return Number(result.lastInsertRowid);
}

export function getReportEmails(): { id: number; email: string; label: string | null; created_at: string }[] {
  return db.prepare('SELECT id, email, label, created_at FROM report_emails ORDER BY created_at DESC').all() as { id: number; email: string; label: string | null; created_at: string }[];
}

export function deleteReportEmail(id: number): void {
  db.prepare('DELETE FROM report_emails WHERE id = ?').run(id);
}
