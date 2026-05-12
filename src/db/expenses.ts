import db from './connection';

// ── Types ────────────────────────────────────────────────────────────────

export interface Expense {
  id?: number;
  category: string;
  description: string;
  amount: number;
  expense_date: string;
  branch_id: number | null;
  created_by: number | null;
  note: string | null;
  is_deleted?: number;
  created_at?: string;
}

export interface ExpenseCategoryTotal {
  category: string;
  total: number;
  count: number;
}

export interface ProfitReport {
  income: number;
  wagesPaid: number;
  otherExpenses: number;
  totalExpenses: number;
  netProfit: number;
  expensesByCategory: ExpenseCategoryTotal[];
  overdueTasks: any[];
  workerSummary: WorkerProfitSummary[];
}

export interface WorkerProfitSummary {
  user_id: number;
  worker_name: string;
  worker_type: string | null;
  tasks_done: number;
  total_earnings: number;
  total_paid: number;
  balance: number;
  efficiency: number;
  total_assigned: number;
  in_progress: number;
  overdue: number;
}

// ── CRUD ─────────────────────────────────────────────────────────────────

export function createExpense(data: Omit<Expense, 'id' | 'is_deleted' | 'created_at'>): number {
  const stmt = db.prepare(`
    INSERT INTO expenses (category, description, amount, expense_date, branch_id, created_by, note)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    data.category,
    data.description,
    data.amount,
    data.expense_date,
    data.branch_id ?? null,
    data.created_by ?? null,
    data.note ?? null,
  );
  return result.lastInsertRowid as number;
}

export function getExpenses(filters?: {
  startDate?: string;
  endDate?: string;
  category?: string;
  branchId?: number;
}): Expense[] {
  const conditions = ['e.is_deleted = 0'];
  const params: any[] = [];

  if (filters?.startDate) {
    conditions.push('e.expense_date >= ?');
    params.push(filters.startDate);
  }
  if (filters?.endDate) {
    conditions.push('e.expense_date <= ?');
    params.push(filters.endDate);
  }
  if (filters?.category) {
    conditions.push('e.category = ?');
    params.push(filters.category);
  }
  if (filters?.branchId) {
    conditions.push('(e.branch_id = ? OR e.branch_id IS NULL)');
    params.push(filters.branchId);
  }

  const where = conditions.join(' AND ');
  const stmt = db.prepare(
    `SELECT e.*, b.name_en as branch_name FROM expenses e LEFT JOIN branches b ON e.branch_id = b.id WHERE ${where} ORDER BY e.expense_date DESC, e.created_at DESC`,
  );
  return stmt.all(...params) as (Expense & { branch_name?: string | null })[];
}

export function deleteExpense(id: number): void {
  db.prepare('UPDATE expenses SET is_deleted = 1 WHERE id = ?').run(id);
}

// ── Totals ───────────────────────────────────────────────────────────────

export function getExpenseTotals(
  startDate: string,
  endDate: string,
  branchId?: number,
): ExpenseCategoryTotal[] {
  const branchFilter = branchId ? ' AND (branch_id = ? OR branch_id IS NULL)' : '';
  const params: any[] = [startDate, endDate];
  if (branchId) params.push(branchId);

  const stmt = db.prepare(`
    SELECT category, SUM(amount) as total, COUNT(*) as count
    FROM expenses
    WHERE is_deleted = 0 AND expense_date >= ? AND expense_date <= ?
    ${branchFilter}
    GROUP BY category
    ORDER BY total DESC
  `);
  return stmt.all(...params) as ExpenseCategoryTotal[];
}

export function getExpenseTotal(
  startDate: string,
  endDate: string,
  branchId?: number,
): number {
  const branchFilter = branchId ? ' AND (branch_id = ? OR branch_id IS NULL)' : '';
  const params: any[] = [startDate, endDate];
  if (branchId) params.push(branchId);

  const row = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE is_deleted = 0 AND expense_date >= ? AND expense_date <= ?
    ${branchFilter}
  `).get(...params) as { total: number };
  return row.total;
}

// ── Profit Report ────────────────────────────────────────────────────────

export function getProfitReport(
  startDate: string,
  endDate: string,
  branchId?: number,
): ProfitReport {
  // 1. Income: total payments received in period
  const incomeParams: any[] = [startDate, endDate + 'T23:59:59'];
  if (branchId) incomeParams.push(branchId);
  const incomeRow = db.prepare(`
    SELECT COALESCE(SUM(op.amount), 0) as total
    FROM order_payments op
    JOIN orders o ON op.order_id = o.id
    WHERE op.created_at >= ? AND op.created_at <= ?
    ${branchId ? ' AND o.branch_id = ?' : ''}
  `).get(...incomeParams) as { total: number };
  const income = incomeRow.total;

  // 2. Wages paid: total worker_payments in period
  const wagesParams: any[] = [startDate, endDate + 'T23:59:59'];
  let wagesPaid = 0;
  try {
    const wagesRow = db.prepare(`
      SELECT COALESCE(SUM(wp.amount), 0) as total
      FROM worker_payments wp
      WHERE wp.created_at >= ? AND wp.created_at <= ?
    `).get(...wagesParams) as { total: number };
    wagesPaid = wagesRow.total;
  } catch {
    wagesPaid = 0;
  }

  // 3. Other expenses
  const otherExpenses = getExpenseTotal(startDate, endDate, branchId);
  const expensesByCategory = getExpenseTotals(startDate, endDate, branchId);

  // 4. Totals
  const totalExpenses = wagesPaid + otherExpenses;
  const netProfit = income - totalExpenses;

  // 5. Worker summary (productivity + earnings + payments)
  let workers: { id: number; name: string; worker_type: string | null; branch_id: number | null }[] = [];
  try {
    workers = db.prepare(
      `SELECT id, name, worker_type, branch_id FROM users WHERE role = 'worker' AND active = 1 ORDER BY name`
    ).all() as typeof workers;
  } catch {
    workers = [];
  }

  const workerSummary: WorkerProfitSummary[] = workers.map((w) => {
    const taskParams: any[] = [w.id, startDate, endDate + 'T23:59:59'];

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total_assigned,
        SUM(CASE WHEN ot.status = 'done' THEN 1 ELSE 0 END) as tasks_done,
        SUM(CASE WHEN ot.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN ot.status != 'done' AND o.delivery_date < date('now') THEN 1 ELSE 0 END) as overdue,
        COALESCE(SUM(CASE WHEN ot.status = 'done' THEN ot.wage_amount ELSE 0 END), 0) as total_earnings
      FROM order_tasks ot
      JOIN orders o ON ot.order_id = o.id
      WHERE ot.assigned_to = ? AND ot.completed_at >= ? AND ot.completed_at <= ?
    `).get(...taskParams) as any;

    const paidRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total_paid
      FROM worker_payments WHERE user_id = ? AND created_at >= ? AND created_at <= ?
    `).get(w.id, startDate, endDate + 'T23:59:59') as { total_paid: number };

    const total = stats?.total_assigned || 0;
    const completed = stats?.tasks_done || 0;

    return {
      user_id: w.id,
      worker_name: w.name,
      worker_type: w.worker_type,
      tasks_done: completed,
      total_earnings: stats?.total_earnings || 0,
      total_paid: paidRow.total_paid,
      balance: (stats?.total_earnings || 0) - paidRow.total_paid,
      efficiency: total > 0 ? Math.round((completed / total) * 100) : 0,
      total_assigned: total,
      in_progress: stats?.in_progress || 0,
      overdue: stats?.overdue || 0,
    };
  });

  // 6. Overdue tasks
  const overdueBranchFilter = branchId ? ' AND o.branch_id = ?' : '';
  const overdueParams: any[] = [];
  if (branchId) overdueParams.push(branchId);
  const overdueTasks = db.prepare(`
    SELECT
      ot.id as task_id, ot.order_id, o.order_number,
      COALESCE(oi.piece_type, o.piece_type) as piece_type,
      ot.task_type, o.delivery_date as due_date,
      c.name as customer_name, u.name as worker_name
    FROM order_tasks ot
    JOIN orders o ON ot.order_id = o.id
    LEFT JOIN order_items oi ON ot.order_item_id = oi.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN users u ON ot.assigned_to = u.id
    WHERE ot.status != 'done' AND o.delivery_date < date('now')
    ${overdueBranchFilter}
    ORDER BY o.delivery_date ASC
  `).all(...overdueParams);

  return {
    income,
    wagesPaid,
    otherExpenses,
    totalExpenses,
    netProfit,
    expensesByCategory,
    overdueTasks,
    workerSummary,
  };
}
