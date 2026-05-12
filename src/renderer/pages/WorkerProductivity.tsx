import React, { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { useTranslation } from '../contexts/I18nContext';

interface ProductivityData {
  user_id: number;
  worker_name: string;
  worker_type: string | null;
  total_assigned: number;
  completed: number;
  in_progress: number;
  pending: number;
  overdue: number;
  efficiency: number;
  cutting_completed: number;
  sewing_completed: number;
}

export default function WorkerProductivityPage() {
  const { t } = useTranslation();
  const [productivity, setProductivity] = useState<ProductivityData[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);
  const [period, setPeriod] = useState<'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);

  const getDateRange = useCallback(() => {
    const now = new Date();
    if (period === 'week') {
      return { start: format(startOfWeek(now), 'yyyy-MM-dd'), end: format(endOfWeek(now), 'yyyy-MM-dd') };
    }
    return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  }, [period]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const range = getDateRange();
      const [prod, overdue] = await Promise.all([
        window.electronAPI.workers.getProductivity(undefined, range.start, range.end),
        window.electronAPI.workers.getOverdueTasks(),
      ]);
      setProductivity((prod || []) as ProductivityData[]);
      setOverdueTasks((overdue || []) as any[]);
    } catch (err) {
      console.error('Failed to load productivity:', err);
    } finally {
      setLoading(false);
    }
  }, [getDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalTasks = productivity.reduce((s, p) => s + p.completed, 0);
  const avgPerWorker = productivity.length > 0 ? Math.round(totalTasks / productivity.length) : 0;
  const totalOverdue = productivity.reduce((s, p) => s + p.overdue, 0);
  const mostProductive = productivity.length > 0
    ? productivity.reduce((best, p) => (p.completed > best.completed ? p : best), productivity[0])
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading...')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            {t('Worker Productivity')}
          </h1>
          <p className="text-secondary mt-1 text-lg">
            {t('Worker performance and production metrics')}
          </p>
        </div>
        <div className="flex gap-1 bg-surface-container rounded-lg p-1">
          <button
            onClick={() => setPeriod('week')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${
              period === 'week'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t('This Week')}
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${
              period === 'month'
                ? 'bg-primary-container text-white shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            {t('This Month')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-36">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Tasks Completed')}</span>
          <span className="text-4xl font-extrabold text-primary">{totalTasks}</span>
        </div>
        <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between h-36">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Avg per Worker')}</span>
          <span className="text-4xl font-extrabold text-on-surface">{avgPerWorker}</span>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-36">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Overdue')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-error">{totalOverdue}</span>
            <span className="text-secondary text-sm">{t('tasks')}</span>
          </div>
        </div>
        <div className="bg-primary-container p-8 rounded-xl text-white flex flex-col justify-between h-36">
          <span className="text-white/80 font-headline text-xs font-bold uppercase tracking-widest">{t('Most Productive')}</span>
          <span className="text-xl font-extrabold truncate">{mostProductive?.worker_name || '--'}</span>
        </div>
      </div>

      {productivity.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">speed</span>
          <p className="font-headline font-bold text-on-surface text-lg">{t('No productivity data available.')}</p>
        </div>
      ) : (
        <>
          {/* Worker Comparison Table */}
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container-high">
              <h2 className="text-lg font-headline font-bold text-on-surface">{t('Worker Comparison')}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Worker Name')}</th>
                    <th>{t('Completed')}</th>
                    <th>{t('In Progress')}</th>
                    <th>{t('Pending')}</th>
                    <th>{t('Overdue')}</th>
                    <th>{t('Efficiency')}</th>
                    <th className="min-w-[180px]">{t('Completion Rate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {productivity.map((p) => (
                    <tr key={p.user_id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold">
                            {p.worker_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface">{p.worker_name}</p>
                            <p className="text-xs text-secondary">
                              {p.worker_type === 'master_cutter' ? t('Master Cutter') : t('Tailor')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="font-bold text-primary">{p.completed}</td>
                      <td>{p.in_progress}</td>
                      <td>{p.pending}</td>
                      <td className={p.overdue > 0 ? 'text-error font-semibold' : ''}>{p.overdue}</td>
                      <td>
                        <span className={`font-bold ${p.efficiency >= 80 ? 'text-primary' : p.efficiency >= 50 ? 'text-on-surface' : 'text-error'}`}>
                          {p.efficiency}%
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2.5 bg-surface-container rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                p.efficiency >= 80 ? 'bg-primary' : p.efficiency >= 50 ? 'bg-tertiary' : 'bg-error'
                              }`}
                              style={{ width: `${p.efficiency}%` }}
                            />
                          </div>
                          <span className="text-xs text-secondary w-8 text-right">{p.completed}/{p.total_assigned}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Task Distribution */}
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container-high">
              <h2 className="text-lg font-headline font-bold text-on-surface">{t('Task Distribution')}</h2>
              <p className="text-secondary text-xs mt-0.5">{t('Cutting vs Sewing tasks per worker')}</p>
            </div>
            <div className="p-6 space-y-4">
              {productivity.map((p) => {
                const total = p.cutting_completed + p.sewing_completed;
                const cuttingPct = total > 0 ? (p.cutting_completed / total) * 100 : 0;
                const sewingPct = total > 0 ? (p.sewing_completed / total) * 100 : 0;
                return (
                  <div key={p.user_id} className="flex items-center gap-4">
                    <span className="text-sm font-semibold text-on-surface w-36 truncate">{p.worker_name}</span>
                    <div className="flex-1 flex gap-1 items-center">
                      <div className="h-6 bg-surface-container rounded-full overflow-hidden flex-1 flex">
                        {p.cutting_completed > 0 && (
                          <div
                            className="h-full bg-tertiary transition-all"
                            style={{ width: `${cuttingPct}%`, minWidth: '12px' }}
                            title={`${t('Cutting Tasks')}: ${p.cutting_completed}`}
                          />
                        )}
                        {p.sewing_completed > 0 && (
                          <div
                            className="h-full bg-primary transition-all"
                            style={{ width: `${sewingPct}%`, minWidth: '12px' }}
                            title={`${t('Sewing Tasks')}: ${p.sewing_completed}`}
                          />
                        )}
                        {total === 0 && (
                          <div className="h-full bg-outline-variant/20 w-full" />
                        )}
                      </div>
                      <div className="flex gap-3 text-xs ml-4 shrink-0">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-tertiary" />
                          {p.cutting_completed} {t('cutting')}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-primary" />
                          {p.sewing_completed} {t('sewing')}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-high">
            <h2 className="text-lg font-headline font-bold text-on-surface flex items-center gap-2">
              <span className="text-error">{t('Overdue')}</span>
              <span className="px-2 py-0.5 bg-error/10 text-error text-xs font-bold rounded-full">{overdueTasks.length}</span>
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Order')}</th>
                  <th>{t('Customer')}</th>
                  <th>{t('Piece Type')}</th>
                  <th>{t('Task Type')}</th>
                  <th>{t('Worker')}</th>
                  <th>{t('Due Date')}</th>
                </tr>
              </thead>
              <tbody>
                {overdueTasks.map((task: any) => (
                  <tr key={task.task_id}>
                    <td className="font-semibold">{task.order_number}</td>
                    <td className="text-secondary">{task.customer_name || '--'}</td>
                    <td>{task.piece_type}</td>
                    <td>
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full capitalize">
                        {t(task.task_type)}
                      </span>
                    </td>
                    <td>{task.worker_name || '--'}</td>
                    <td className="text-error font-semibold">{task.due_date || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
