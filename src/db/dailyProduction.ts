import db from './connection';

export interface DailyProduction {
  id?: number;
  worker_id: number;
  production_date: string;
  piece_type: string;
  quantity: number;
  wage_rate: number;
  wage_amount: number;
  notes?: string;
  created_by?: number;
  created_at?: string;
}

export interface DailyProductionView {
  id: number;
  worker_name: string;
  production_date: string;
  piece_type: string;
  quantity: number;
  wage_rate: number;
  wage_amount: number;
  notes?: string;
  created_at?: string;
}

// Create a new daily production record
export function createDailyProduction(record: Omit<DailyProduction, 'id'>): number {
  const stmt = db.prepare(`
    INSERT INTO daily_production (worker_id, production_date, piece_type, quantity, wage_rate, wage_amount, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    record.worker_id,
    record.production_date,
    record.piece_type,
    record.quantity,
    record.wage_rate,
    record.wage_amount,
    record.notes || null,
    record.created_by || null
  );
  return result.lastInsertRowid as number;
}

// Get all daily production records (with filtering)
export function getDailyProduction(filters?: {
  worker_id?: number;
  start_date?: string;
  end_date?: string;
}): DailyProductionView[] {
  let query = `
    SELECT
      dp.id,
      dp.worker_id,
      u.name as worker_name,
      dp.production_date,
      dp.piece_type,
      dp.quantity,
      dp.wage_rate,
      dp.wage_amount,
      dp.notes,
      dp.created_at
    FROM daily_production dp
    JOIN users u ON dp.worker_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters?.worker_id) {
    query += ' AND dp.worker_id = ?';
    params.push(filters.worker_id);
  }
  if (filters?.start_date) {
    query += ' AND dp.production_date >= ?';
    params.push(filters.start_date);
  }
  if (filters?.end_date) {
    query += ' AND dp.production_date <= ?';
    params.push(filters.end_date);
  }

  query += ' ORDER BY dp.production_date DESC, dp.created_at DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params) as DailyProductionView[];
}

// Get daily production for a specific date
export function getDailyProductionByDate(date: string): DailyProductionView[] {
  const stmt = db.prepare(`
    SELECT
      dp.id,
      dp.worker_id,
      u.name as worker_name,
      dp.production_date,
      dp.piece_type,
      dp.quantity,
      dp.wage_rate,
      dp.wage_amount,
      dp.notes,
      dp.created_at
    FROM daily_production dp
    JOIN users u ON dp.worker_id = u.id
    WHERE dp.production_date = ?
    ORDER BY u.name, dp.piece_type
  `);
  return stmt.all(date) as DailyProductionView[];
}

// Get worker production summary for a period
export interface WorkerProductionSummary {
  worker_id: number;
  worker_name: string;
  total_quantity: number;
  total_wage: number;
  details: {
    piece_type: string;
    quantity: number;
    total_wage: number;
  }[];
}

export function getWorkerProductionSummary(workerId: number, startDate: string, endDate: string): WorkerProductionSummary {
  // Get overall summary
  const summaryStmt = db.prepare(`
    SELECT
      u.id as worker_id,
      u.name as worker_name,
      SUM(dp.quantity) as total_quantity,
      SUM(dp.wage_amount) as total_wage
    FROM daily_production dp
    JOIN users u ON dp.worker_id = u.id
    WHERE dp.worker_id = ? AND dp.production_date BETWEEN ? AND ?
    GROUP BY u.id, u.name
  `);
  const summary = summaryStmt.get(workerId, startDate, endDate) as any;

  if (!summary) {
    return {
      worker_id: workerId,
      worker_name: '',
      total_quantity: 0,
      total_wage: 0,
      details: [],
    };
  }

  // Get details by piece type
  const detailsStmt = db.prepare(`
    SELECT
      piece_type,
      SUM(quantity) as quantity,
      SUM(wage_amount) as total_wage
    FROM daily_production
    WHERE worker_id = ? AND production_date BETWEEN ? AND ?
    GROUP BY piece_type
    ORDER BY piece_type
  `);
  const details = detailsStmt.all(workerId, startDate, endDate) as any[];

  return {
    worker_id: summary.worker_id,
    worker_name: summary.worker_name,
    total_quantity: summary.total_quantity || 0,
    total_wage: summary.total_wage || 0,
    details: details.map(d => ({
      piece_type: d.piece_type,
      quantity: d.quantity,
      total_wage: d.total_wage,
    })),
  };
}

// Get all workers' production for a period
export function getAllWorkersProduction(startDate: string, endDate: string): WorkerProductionSummary[] {
  const stmt = db.prepare(`
    SELECT DISTINCT worker_id
    FROM daily_production
    WHERE production_date BETWEEN ? AND ?
  `);
  const workerIds = stmt.all(startDate, endDate) as { worker_id: number }[];

  return workerIds.map(w => getWorkerProductionSummary(w.worker_id, startDate, endDate));
}

// Delete a daily production record
export function deleteDailyProduction(id: number): void {
  const stmt = db.prepare('DELETE FROM daily_production WHERE id = ?');
  stmt.run(id);
}

// Update a daily production record
export function updateDailyProduction(id: number, data: Partial<DailyProduction>): void {
  const stmt = db.prepare(`
    UPDATE daily_production SET
      production_date = ?,
      piece_type = ?,
      quantity = ?,
      wage_rate = ?,
      wage_amount = ?,
      notes = ?
    WHERE id = ?
  `);
  stmt.run(
    data.production_date,
    data.piece_type,
    data.quantity,
    data.wage_rate,
    data.wage_amount,
    data.notes || null,
    id
  );
}

// Get daily production by date range grouped by worker
export interface DailyProductionGrouped {
  production_date: string;
  worker_name: string;
  worker_id: number;
  entries: {
    piece_type: string;
    quantity: number;
    wage_amount: number;
  }[];
  total_quantity: number;
  total_wage: number;
}

export function getDailyProductionGrouped(startDate: string, endDate: string): DailyProductionGrouped[] {
  const stmt = db.prepare(`
    SELECT
      dp.production_date,
      dp.worker_id,
      u.name as worker_name,
      dp.piece_type,
      dp.quantity,
      dp.wage_amount
    FROM daily_production dp
    JOIN users u ON dp.worker_id = u.id
    WHERE dp.production_date BETWEEN ? AND ?
    ORDER BY dp.production_date DESC, u.name, dp.piece_type
  `);
  const rows = stmt.all(startDate, endDate) as any[];

  // Group by date and worker
  const grouped: Record<string, DailyProductionGrouped> = {};

  for (const row of rows) {
    const key = `${row.production_date}-${row.worker_id}`;
    if (!grouped[key]) {
      grouped[key] = {
        production_date: row.production_date,
        worker_id: row.worker_id,
        worker_name: row.worker_name,
        entries: [],
        total_quantity: 0,
        total_wage: 0,
      };
    }
    grouped[key].entries.push({
      piece_type: row.piece_type,
      quantity: row.quantity,
      wage_amount: row.wage_amount,
    });
    grouped[key].total_quantity += row.quantity;
    grouped[key].total_wage += row.wage_amount;
  }

  return Object.values(grouped);
}
