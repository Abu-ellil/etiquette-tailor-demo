import db from './connection';

export interface Customer {
  id?: number;
  name: string;
  phone?: string;
  notes?: string;
  branch_id: number;
  created_at?: string;
}

export function getAllCustomers(branchId?: number): Customer[] {
  if (branchId) {
    const stmt = db.prepare('SELECT * FROM customers WHERE branch_id = ? ORDER BY created_at DESC');
    return stmt.all(branchId) as Customer[];
  }
  const stmt = db.prepare('SELECT * FROM customers ORDER BY created_at DESC');
  return stmt.all() as Customer[];
}

export function getCustomer(id: number): Customer | undefined {
  const stmt = db.prepare('SELECT * FROM customers WHERE id = ?');
  return stmt.get(id) as Customer | undefined;
}

export function searchCustomers(query: string, branchId?: number): Customer[] {
  const searchTerm = `%${query}%`;
  if (branchId) {
    const stmt = db.prepare(
      'SELECT * FROM customers WHERE branch_id = ? AND (name LIKE ? OR phone LIKE ?) ORDER BY created_at DESC'
    );
    return stmt.all(branchId, searchTerm, searchTerm) as Customer[];
  }
  const stmt = db.prepare(
    'SELECT * FROM customers WHERE name LIKE ? OR phone LIKE ? ORDER BY created_at DESC'
  );
  return stmt.all(searchTerm, searchTerm) as Customer[];
}

export function createCustomer(customer: Omit<Customer, 'id'>): number {
  const stmt = db.prepare(
    'INSERT INTO customers (name, phone, notes, branch_id) VALUES (?, ?, ?, ?)'
  );
  const result = stmt.run(customer.name, customer.phone || null, customer.notes || null, customer.branch_id);
  return result.lastInsertRowid as number;
}

export function updateCustomer(id: number, customer: Partial<Customer>): void {
  const stmt = db.prepare(`
    UPDATE customers SET name = ?, phone = ?, notes = ? WHERE id = ?
  `);
  stmt.run(customer.name, customer.phone || null, customer.notes || null, id);
}

export function deleteCustomer(id: number): void {
  const stmt = db.prepare('DELETE FROM customers WHERE id = ?');
  stmt.run(id);
}

export function getCustomerOrders(customerId: number): any[] {
  const stmt = db.prepare(`
    SELECT o.*, c.name as customer_name, c.phone as customer_phone,
      COALESCE(ps.paid_sum, 0) as paid
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN (SELECT order_id, SUM(amount) as paid_sum FROM order_payments GROUP BY order_id) ps ON ps.order_id = o.id
    WHERE o.customer_id = ? AND o.is_deleted = 0
    ORDER BY o.created_at DESC
  `);
  return stmt.all(customerId);
}

export function getCustomerOutstandingOrders(customerId: number): any[] {
  const stmt = db.prepare(`
    SELECT o.id, o.order_number, o.piece_type, o.price,
      COALESCE(ps.paid_sum, 0) as paid,
      o.price - COALESCE(ps.paid_sum, 0) as balance,
      o.status, o.delivery_date, o.created_at
    FROM orders o
    LEFT JOIN (SELECT order_id, SUM(amount) as paid_sum FROM order_payments GROUP BY order_id) ps ON ps.order_id = o.id
    WHERE o.customer_id = ? AND o.is_deleted = 0 AND o.status != 'delivered' AND (o.price - COALESCE(ps.paid_sum, 0)) > 0
    ORDER BY o.created_at DESC
  `);
  return stmt.all(customerId);
}
