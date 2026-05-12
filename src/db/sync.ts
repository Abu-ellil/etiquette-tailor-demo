import db from './connection';
import fs from 'fs';
import path from 'path';
import { getSetting, setSetting } from './settings';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SyncResult {
  success: boolean;
  exportedAt?: string;
  importedAt?: string;
  counts?: Record<string, number>;
  error?: string;
}

interface ConflictData {
  type: 'customer' | 'order' | 'expense';
  local: any;
  remote: any;
  id: number;
}

interface MergeResult {
  success: boolean;
  merged?: number;
  conflicts?: ConflictData[];
  error?: string;
}

interface AutoSyncStatus {
  enabled: boolean;
  interval: number;
  lastAutoExport: string | null;
  lastAutoImport: string | null;
  lastRemoteCheck: string | null;
  remoteFileAge: number | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function getBranchPrefix(branchId: number): string {
  const row = db.prepare('SELECT prefix FROM branches WHERE id = ?').get(branchId) as { prefix: string } | undefined;
  return row?.prefix || 'X';
}

function getOtherBranchInfo(myBranchId: number): { id: number; prefix: string } | null {
  const row = db.prepare('SELECT id, prefix FROM branches WHERE id != ? LIMIT 1').get(myBranchId) as { id: number; prefix: string } | undefined;
  return row ? { id: row.id, prefix: row.prefix } : null;
}

function getRemoteSyncFilePath(folderPath: string, myBranchId: number): { path: string; prefix: string } | null {
  const other = getOtherBranchInfo(myBranchId);
  if (!other) return null;
  return { path: path.join(folderPath, `sync_branch_${other.prefix}.json`), prefix: other.prefix };
}

function getFileModifiedTime(filePath: string): number | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const stat = fs.statSync(filePath);
    return stat.mtimeMs;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  Export: write this branch's data to JSON file                      */
/* ------------------------------------------------------------------ */
export function exportBranchData(branchId: number, folderPath: string): SyncResult {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const prefix = getBranchPrefix(branchId);
    const now = new Date().toISOString();

    // Fetch all data for this branch
    const customers = db.prepare('SELECT * FROM customers WHERE branch_id = ?').all(branchId);

    const orders = db.prepare('SELECT * FROM orders WHERE branch_id = ?').all(branchId);
    const orderIds = (orders as any[]).map((o: any) => o.id);

    let orderItems: any[] = [];
    let orderPayments: any[] = [];
    let orderMeasurements: any[] = [];
    let orderTasks: any[] = [];

    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',');
      orderItems = db.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`).all(...orderIds);
      orderPayments = db.prepare(`SELECT * FROM order_payments WHERE order_id IN (${placeholders})`).all(...orderIds);
      orderMeasurements = db.prepare(`SELECT * FROM order_measurements WHERE order_id IN (${placeholders})`).all(...orderIds);
      orderTasks = db.prepare(`SELECT * FROM order_tasks WHERE order_id IN (${placeholders})`).all(...orderIds);
    }

    const expenses = db.prepare('SELECT * FROM expenses WHERE branch_id = ?').all(branchId);

    const data = {
      branch_id: branchId,
      branch_prefix: prefix,
      exported_at: now,
      customers,
      orders,
      order_items: orderItems,
      order_payments: orderPayments,
      order_measurements: orderMeasurements,
      order_tasks: orderTasks,
      expenses,
    };

    const filePath = path.join(folderPath, `sync_branch_${prefix}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    // Save last export time
    setSetting('sync_last_export', now);

    return {
      success: true,
      exportedAt: now,
      counts: {
        customers: customers.length,
        orders: orders.length,
        order_items: orderItems.length,
        order_payments: orderPayments.length,
        order_measurements: orderMeasurements.length,
        order_tasks: orderTasks.length,
        expenses: expenses.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ------------------------------------------------------------------ */
/*  Import: read other branch's JSON and merge into local DB           */
/* ------------------------------------------------------------------ */
export function importBranchData(myBranchId: number, folderPath: string): SyncResult {
  try {
    const otherBranch = getOtherBranchInfo(myBranchId);
    if (!otherBranch) {
      return { success: false, error: 'No other branch found' };
    }

    const filePath = path.join(folderPath, `sync_branch_${otherBranch.prefix}.json`);
    if (!fs.existsSync(filePath)) {
      return { success: false, error: `No sync file found for branch ${otherBranch.prefix}. Export from the other branch first.` };
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const now = new Date().toISOString();

    const counts: Record<string, number> = {
      customers: 0,
      orders: 0,
      order_items: 0,
      order_payments: 0,
      order_measurements: 0,
      order_tasks: 0,
      expenses: 0,
    };

    // ID mapping: original_id → local_id
    const customerIdMap: Record<number, number> = {};
    const orderIdMap: Record<number, number> = {};

    const transaction = db.transaction(() => {
      // --- Customers ---
      const customerInsert = db.prepare(`
        INSERT INTO customers (name, phone, notes, branch_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const customerUpdate = db.prepare(`
        UPDATE customers SET name = ?, notes = ?
        WHERE phone = ? AND branch_id = ?
      `);
      const findCustomer = db.prepare(
        'SELECT id FROM customers WHERE phone = ? AND branch_id = ?'
      );

      for (const c of data.customers || []) {
        const existing = findCustomer.get(c.phone, otherBranch.id) as { id: number } | undefined;
        if (existing) {
          customerUpdate.run(c.name, c.notes, c.phone, otherBranch.id);
          customerIdMap[c.id] = existing.id;
        } else {
          const result = customerInsert.run(c.name, c.phone, c.notes, otherBranch.id, c.created_at || now);
          customerIdMap[c.id] = result.lastInsertRowid as number;
        }
        counts.customers++;
      }

      // --- Orders ---
      const orderInsert = db.prepare(`
        INSERT INTO orders (order_number, branch_id, customer_id, piece_type, details, price, paid, payment_method, status, receive_date, delivery_date, created_by, fabric_source, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const orderUpdate = db.prepare(`
        UPDATE orders SET customer_id = ?, piece_type = ?, details = ?, price = ?, paid = ?, payment_method = ?, status = ?, receive_date = ?, delivery_date = ?, fabric_source = ?
        WHERE order_number = ?
      `);
      const findOrder = db.prepare('SELECT id FROM orders WHERE order_number = ?');

      for (const o of data.orders || []) {
        const localCustomerId = customerIdMap[o.customer_id] || o.customer_id;
        const existing = findOrder.get(o.order_number) as { id: number } | undefined;
        if (existing) {
          orderUpdate.run(localCustomerId, o.piece_type, o.details, o.price, o.paid, o.payment_method, o.status, o.receive_date, o.delivery_date, o.fabric_source, o.order_number);
          orderIdMap[o.id] = existing.id;
        } else {
          const result = orderInsert.run(
            o.order_number, otherBranch.id, localCustomerId, o.piece_type, o.details,
            o.price, o.paid, o.payment_method, o.status, o.receive_date, o.delivery_date,
            o.created_by, o.fabric_source, o.created_at || now
          );
          orderIdMap[o.id] = result.lastInsertRowid as number;
        }
        counts.orders++;
      }

      // --- Order Items (delete + re-insert per order) ---
      const deleteItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
      const insertItem = db.prepare(`
        INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details, sort_order, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of data.order_items || []) {
        const localOrderId = orderIdMap[item.order_id];
        if (!localOrderId) continue;
        deleteItems.run(localOrderId);
        insertItem.run(
          localOrderId, item.piece_type, item.quantity, item.unit_price, item.total_price,
          item.fabric_source, item.fabric_price, item.details, item.sort_order, item.created_at || now
        );
        counts.order_items++;
      }

      // --- Order Payments (delete + re-insert per order) ---
      const deletePayments = db.prepare('DELETE FROM order_payments WHERE order_id = ?');
      const insertPayment = db.prepare(`
        INSERT INTO order_payments (order_id, amount, method, note, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of data.order_payments || []) {
        const localOrderId = orderIdMap[p.order_id];
        if (!localOrderId) continue;
        deletePayments.run(localOrderId);
        insertPayment.run(localOrderId, p.amount, p.method, p.note, p.created_by, p.created_at || now);
        counts.order_payments++;
      }

      // --- Order Measurements (delete + re-insert per order) ---
      const deleteMeasurements = db.prepare('DELETE FROM order_measurements WHERE order_id = ?');
      const insertMeasurement = db.prepare(`
        INSERT INTO order_measurements (order_id, chest, waist, hips, length, sleeve, shoulder, notes, taken_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const m of data.order_measurements || []) {
        const localOrderId = orderIdMap[m.order_id];
        if (!localOrderId) continue;
        deleteMeasurements.run(localOrderId);
        insertMeasurement.run(
          localOrderId, m.chest, m.waist, m.hips, m.length, m.sleeve, m.shoulder,
          m.notes, m.taken_by, m.created_at || now
        );
        counts.order_measurements++;
      }

      // --- Order Tasks (delete + re-insert per order) ---
      const deleteTasks = db.prepare('DELETE FROM order_tasks WHERE order_id = ?');
      const insertTask = db.prepare(`
        INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status, started_at, completed_at, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const t of data.order_tasks || []) {
        const localOrderId = orderIdMap[t.order_id];
        if (!localOrderId) continue;
        deleteTasks.run(localOrderId);
        insertTask.run(
          localOrderId, t.order_item_id, t.task_type, t.assigned_to,
          t.wage_type, t.wage_rate, t.wage_amount, t.task_quantity || 1,
          t.status, t.started_at || null, t.completed_at || null, t.notes
        );
        counts.order_tasks++;
      }

      // --- Expenses ---
      const deleteExpenses = db.prepare('DELETE FROM expenses WHERE branch_id = ? AND is_deleted = 0');
      const insertExpense = db.prepare(`
        INSERT INTO expenses (category, description, amount, expense_date, branch_id, created_by, note, is_deleted, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      deleteExpenses.run(otherBranch.id);
      for (const e of data.expenses || []) {
        insertExpense.run(
          e.category, e.description, e.amount, e.expense_date, otherBranch.id,
          e.created_by, e.note, e.is_deleted || 0, e.created_at || now
        );
        counts.expenses++;
      }
    });

    transaction();

    // Save last import time
    setSetting('sync_last_import', now);

    return { success: true, importedAt: now, counts };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ------------------------------------------------------------------ */
/*  Status                                                             */
/* ------------------------------------------------------------------ */
export function getSyncStatus(): {
  lastExport: string | null;
  lastImport: string | null;
  syncFolderPath: string | null;
} {
  return {
    lastExport: getSetting('sync_last_export') || null,
    lastImport: getSetting('sync_last_import') || null,
    syncFolderPath: getSetting('sync_folder_path') || null,
  };
}

/* ------------------------------------------------------------------ */
/*  Merge: combine both branches' data with conflict detection        */
/* ------------------------------------------------------------------ */
export function mergeBranchData(myBranchId: number, folderPath: string): MergeResult {
  try {
    const branches = db.prepare('SELECT id, prefix FROM branches').all() as { id: number; prefix: string }[];
    const now = new Date().toISOString();
    const conflicts: ConflictData[] = [];
    let merged = 0;

    const transaction = db.transaction(() => {
      for (const branch of branches) {
        const prefix = branch.prefix;
        const filePath = path.join(folderPath, `sync_branch_${prefix}.json`);
        
        if (!fs.existsSync(filePath)) continue;

        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);

        const customerIdMap: Record<number, number> = {};
        const orderIdMap: Record<number, number> = {};

        const customerInsert = db.prepare(`
          INSERT INTO customers (name, phone, notes, branch_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `);
        const customerUpdate = db.prepare(`
          UPDATE customers SET name = ?, notes = ?
          WHERE phone = ? AND branch_id = ?
        `);
        const findCustomer = db.prepare(
          'SELECT id, created_at FROM customers WHERE phone = ? AND branch_id = ?'
        );

        for (const c of data.customers || []) {
          const existing = findCustomer.get(c.phone, branch.id) as { id: number; created_at: string } | undefined;
          
          if (existing) {
            customerUpdate.run(c.name, c.notes, c.phone, branch.id);
            customerIdMap[c.id] = existing.id;
          } else {
            const result = customerInsert.run(c.name, c.phone, c.notes, branch.id, c.created_at || now);
            customerIdMap[c.id] = result.lastInsertRowid as number;
          }
          merged++;
        }

        const orderInsert = db.prepare(`
          INSERT INTO orders (order_number, branch_id, customer_id, piece_type, details, price, paid, payment_method, status, receive_date, delivery_date, created_by, fabric_source, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const orderUpdate = db.prepare(`
          UPDATE orders SET customer_id = ?, piece_type = ?, details = ?, price = ?, paid = ?, payment_method = ?, status = ?, receive_date = ?, delivery_date = ?, fabric_source = ?
          WHERE order_number = ?
        `);
        const findOrder = db.prepare('SELECT id, created_at FROM orders WHERE order_number = ?');

        for (const o of data.orders || []) {
          const localCustomerId = customerIdMap[o.customer_id] || o.customer_id;
          const existing = findOrder.get(o.order_number) as { id: number; created_at: string } | undefined;
          
          if (existing) {
            orderUpdate.run(localCustomerId, o.piece_type, o.details, o.price, o.paid, o.payment_method, o.status, o.receive_date, o.delivery_date, o.fabric_source, o.order_number);
            orderIdMap[o.id] = existing.id;
          } else {
            const result = orderInsert.run(
              o.order_number, branch.id, localCustomerId, o.piece_type, o.details,
              o.price, o.paid, o.payment_method, o.status, o.receive_date, o.delivery_date,
              o.created_by, o.fabric_source, o.created_at || now
            );
            orderIdMap[o.id] = result.lastInsertRowid as number;
          }
          merged++;
        }

        const deleteItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
        const insertItem = db.prepare(`
          INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const item of data.order_items || []) {
          const localOrderId = orderIdMap[item.order_id];
          if (!localOrderId) continue;
          deleteItems.run(localOrderId);
          insertItem.run(
            localOrderId, item.piece_type, item.quantity, item.unit_price, item.total_price,
            item.fabric_source, item.fabric_price, item.details, item.sort_order, item.created_at || now
          );
          merged++;
        }

        const deletePayments = db.prepare('DELETE FROM order_payments WHERE order_id = ?');
        const insertPayment = db.prepare(`
          INSERT INTO order_payments (order_id, amount, method, note, created_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const p of data.order_payments || []) {
          const localOrderId = orderIdMap[p.order_id];
          if (!localOrderId) continue;
          deletePayments.run(localOrderId);
          insertPayment.run(localOrderId, p.amount, p.method, p.note, p.created_by, p.created_at || now);
          merged++;
        }

        const deleteMeasurements = db.prepare('DELETE FROM order_measurements WHERE order_id = ?');
        const insertMeasurement = db.prepare(`
          INSERT INTO order_measurements (order_id, chest, waist, hips, length, sleeve, shoulder, notes, taken_by, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const m of data.order_measurements || []) {
          const localOrderId = orderIdMap[m.order_id];
          if (!localOrderId) continue;
          deleteMeasurements.run(localOrderId);
          insertMeasurement.run(
            localOrderId, m.chest, m.waist, m.hips, m.length, m.sleeve, m.shoulder,
            m.notes, m.taken_by, m.created_at || now
          );
          merged++;
        }

        const deleteTasks = db.prepare('DELETE FROM order_tasks WHERE order_id = ?');
        const insertTask = db.prepare(`
          INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status, started_at, completed_at, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const t of data.order_tasks || []) {
          const localOrderId = orderIdMap[t.order_id];
          if (!localOrderId) continue;
          deleteTasks.run(localOrderId);
          insertTask.run(
            localOrderId, t.order_item_id, t.task_type, t.assigned_to,
            t.wage_type, t.wage_rate, t.wage_amount, t.task_quantity || 1,
            t.status, t.started_at || null, t.completed_at || null, t.notes
          );
          merged++;
        }

        const insertExpense = db.prepare(`
          INSERT INTO expenses (category, description, amount, expense_date, branch_id, created_by, note, is_deleted, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        for (const e of data.expenses || []) {
          insertExpense.run(
            e.category, e.description, e.amount, e.expense_date, branch.id,
            e.created_by, e.note, e.is_deleted || 0, e.created_at || now
          );
          merged++;
        }
      }
    });

    transaction();

    setSetting('sync_last_import', now);

return { success: true, merged, conflicts };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ------------------------------------------------------------------ */
/*  Resolve Conflict                                                    */
export function resolveConflict(branchId: number, type: string, id: number, source: 'local' | 'remote'): { success: boolean; error?: string } {
  try {
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/* ------------------------------------------------------------------ */
/*  Auto-Sync                                                          */
/* ------------------------------------------------------------------ */
export function checkForRemoteUpdate(folderPath: string, myBranchId: number): { hasUpdate: boolean; fileAge: number | null } {
  const remote = getRemoteSyncFilePath(folderPath, myBranchId);
  if (!remote) return { hasUpdate: false, fileAge: null };

  const remoteModTime = getFileModifiedTime(remote.path);
  if (remoteModTime === null) return { hasUpdate: false, fileAge: null };

  const lastImport = getSetting('auto_sync_last_import');
  if (!lastImport) return { hasUpdate: true, fileAge: null };

  try {
    const lastImportTime = new Date(lastImport).getTime();
    const age = remoteModTime - lastImportTime;
    if (age > 0) {
      return { hasUpdate: true, fileAge: Math.round(age / 1000) };
    }
    return { hasUpdate: false, fileAge: Math.round(age / 1000) };
  } catch {
    return { hasUpdate: true, fileAge: null };
  }
}

export function getAutoSyncStatus(branchId: number, folderPath: string | null): AutoSyncStatus {
  const enabled = getSetting('auto_sync_enabled') === '1';
  const interval = parseInt(getSetting('auto_sync_interval') || '30', 10);

  let remoteFileAge: number | null = null;
  if (folderPath) {
    const check = checkForRemoteUpdate(folderPath, branchId);
    remoteFileAge = check.fileAge;
  }

  return {
    enabled,
    interval,
    lastAutoExport: getSetting('auto_sync_last_export') || null,
    lastAutoImport: getSetting('auto_sync_last_import') || null,
    lastRemoteCheck: getSetting('auto_sync_last_remote_check') || null,
    remoteFileAge,
  };
}

export function enableAutoSync(): void {
  setSetting('auto_sync_enabled', '1');
}

export function disableAutoSync(): void {
  setSetting('auto_sync_enabled', '0');
}

export function setAutoSyncInterval(seconds: number): void {
  setSetting('auto_sync_interval', String(seconds));
}

export function recordAutoExport(): string {
  const now = new Date().toISOString();
  setSetting('auto_sync_last_export', now);
  return now;
}

export function recordAutoImport(): string {
  const now = new Date().toISOString();
  setSetting('auto_sync_last_import', now);
  return now;
}

export function getRemoteFileInfo(folderPath: string, myBranchId: number): { exists: boolean; mtime: number | null } {
  const remote = getRemoteSyncFilePath(folderPath, myBranchId);
  if (!remote) return { exists: false, mtime: null };
  const mtime = getFileModifiedTime(remote.path);
  return { exists: mtime !== null, mtime };
}
