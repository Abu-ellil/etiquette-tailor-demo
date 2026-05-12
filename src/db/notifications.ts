import db from './schema';

export interface Notification {
  id?: number;
  type: 'order_created' | 'order_status_changed' | 'order_overdue' | 'payment_received' | 'task_status_changed';
  title: string;
  message: string;
  order_id?: number | null;
  task_id?: number | null;
  target_user_id?: number | null;
  target_role?: string | null;
  is_read: number;
  is_deleted: number;
  created_at?: string;
  order_number?: string;
}

export function createNotification(data: Omit<Notification, 'id' | 'is_read' | 'is_deleted' | 'created_at'>): number {
  const stmt = db.prepare(`
    INSERT INTO notifications (type, title, message, order_id, task_id, target_user_id, target_role)
    VALUES (@type, @title, @message, @order_id, @task_id, @target_user_id, @target_role)
  `);
  const result = stmt.run({
    type: data.type,
    title: data.title,
    message: data.message,
    order_id: data.order_id ?? null,
    task_id: data.task_id ?? null,
    target_user_id: data.target_user_id ?? null,
    target_role: data.target_role ?? null,
  });
  return result.lastInsertRowid as number;
}

export function getNotificationsForUser(userId: number, role: string, limit = 20): Notification[] {
  let query: string;
  let params: any[];

  if (role === 'worker') {
    query = `
      SELECT n.*, o.order_number
      FROM notifications n
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE n.is_deleted = 0
        AND n.target_user_id = ?
      ORDER BY n.created_at DESC
      LIMIT ?
    `;
    params = [userId, limit];
  } else {
    query = `
      SELECT n.*, o.order_number
      FROM notifications n
      LEFT JOIN orders o ON n.order_id = o.id
      WHERE n.is_deleted = 0
        AND (
          (n.target_role IN ('admin', 'manager'))
          OR n.target_user_id = ?
        )
      ORDER BY n.created_at DESC
      LIMIT ?
    `;
    params = [userId, limit];
  }

  return db.prepare(query).all(...params) as Notification[];
}

export function getUnreadCount(userId: number, role: string): number {
  let query: string;
  let params: any[];

  if (role === 'worker') {
    query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE is_deleted = 0 AND is_read = 0
        AND target_user_id = ?
    `;
    params = [userId];
  } else {
    query = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE is_deleted = 0 AND is_read = 0
        AND (
          (target_role IN ('admin', 'manager'))
          OR target_user_id = ?
        )
    `;
    params = [userId];
  }

  const row = db.prepare(query).get(...params) as { count: number };
  return row.count;
}

export function markAsRead(notificationId: number): void {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notificationId);
}

export function markAllAsRead(userId: number, role: string): void {
  if (role === 'worker') {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND is_deleted = 0 AND target_user_id = ?').run(userId);
  } else {
    db.prepare(`
      UPDATE notifications SET is_read = 1
      WHERE is_read = 0 AND is_deleted = 0
        AND (
          (target_role IN ('admin', 'manager'))
          OR target_user_id = ?
        )
    `).run(userId);
  }
}

export function softDeleteNotification(notificationId: number): void {
  db.prepare('UPDATE notifications SET is_deleted = 1 WHERE id = ?').run(notificationId);
}

export function clearReadNotifications(userId: number, role: string): number {
  let query: string;
  let params: any[];

  if (role === 'worker') {
    query = `UPDATE notifications SET is_deleted = 1 WHERE is_read = 1 AND is_deleted = 0 AND target_user_id = ?`;
    params = [userId];
  } else {
    query = `UPDATE notifications SET is_deleted = 1 WHERE is_read = 1 AND is_deleted = 0 AND ((target_role IN ('admin', 'manager')) OR target_user_id = ?)`;
    params = [userId];
  }

  const result = db.prepare(query).run(...params);
  return result.changes;
}

export function generateOverdueNotifications(): number {
  const overdueOrders = db.prepare(`
    SELECT o.id, o.order_number, c.name as customer_name, o.delivery_date
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.status != 'delivered'
      AND o.delivery_date IS NOT NULL
      AND o.delivery_date < date('now')
      AND NOT EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.order_id = o.id
          AND n.type = 'order_overdue'
          AND date(n.created_at) = date('now')
      )
  `).all() as { id: number; order_number: string; customer_name: string; delivery_date: string }[];

  if (overdueOrders.length === 0) return 0;

  const insertStmt = db.prepare(`
    INSERT INTO notifications (type, title, message, order_id, target_role)
    VALUES ('order_overdue', 'Overdue Order', ?, ?, ?)
  `);

  const txn = db.transaction(() => {
    for (const order of overdueOrders) {
      const msg = `Order ${order.order_number} for ${order.customer_name || 'customer'} is past due (${order.delivery_date})`;
      insertStmt.run(msg, order.id, 'admin');
      insertStmt.run(msg, order.id, 'manager');
    }
  });

  txn();
  return overdueOrders.length;
}
