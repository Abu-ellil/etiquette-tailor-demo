import React, { useState, useEffect, useCallback } from 'react';
import StatusChip from '../components/StatusChip';
import { useTranslation } from '../contexts/I18nContext';

const TASK_TYPE_ICONS: Record<string, string> = {
  cutting: 'content_cut',
  sewing: 'styler',
  design: 'palette',
};

export default function TaskBoardPage() {
  const { t, currency } = useTranslation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [pieceTypes, setPieceTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<{ branchId?: number; workerId?: number; taskType?: string }>({});
  const [session, setSession] = useState<any>(null);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);
  const [recommendedForTask, setRecommendedForTask] = useState<any[]>([]);
  const [workerRates, setWorkerRates] = useState<Record<string, any>>({});

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const sess = await window.electronAPI.auth.getSession();
      setSession(sess);
      const effectiveFilters = { ...filters };
      if (sess?.role === 'manager') {
        effectiveFilters.branchId = sess.branch_id;
      }
      const [taskData, workerData, branchData, ptData] = await Promise.all([
        window.electronAPI.orders.getAllTasks(effectiveFilters),
        window.electronAPI.workers.getAll(),
        window.electronAPI.branches.getAll(),
        window.electronAPI.pieceTypes.getAll(),
      ]);
      setTasks(taskData || []);
      setWorkers(workerData || []);
      setBranches(branchData || []);
      setPieceTypes(ptData || []);
    } catch (err) {
      console.error('Failed to load task board:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toISOString().split('T')[0];
  const isAdmin = session?.role === 'admin' || session?.role === 'manager';

  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = tasks.filter((t) => t.due_date && t.due_date < today && t.status !== 'done').length;
  const unassignedCount = tasks.filter((t) => !t.assigned_to).length;

  const getBasePrice = (pieceType: string): number => {
    const pt = pieceTypes.find((p: any) => p.name_en === pieceType);
    return pt?.base_price || 0;
  };

  const calcWage = (basePrice: number, wageType: string, rate: number, qty: number): number => {
    return wageType === 'percentage' ? basePrice * (rate / 100) * qty : rate * qty;
  };

  const handleQuickAssign = async (taskId: number, workerId: number) => {
    const task = tasks.find((t: any) => t.task_id === taskId);
    if (!task) return;
    const pieceType = task.item_piece_type || task.piece_type;
    try {
      const rate = await window.electronAPI.workers.getActiveRate(workerId, pieceType);
      const worker = workers.find((w: any) => w.id === workerId);
      if (!rate && !worker?.default_rate) {
        alert(t('No rate configured for this worker and piece type. Please set the rate in Worker Rates first.'));
        return;
      }
      const wageType = rate?.wage_type || 'percentage';
      const wageRate = rate?.rate || worker?.default_rate || 0;
      const bp = getBasePrice(pieceType);
      const qty = task.task_quantity || 1;
      const wageAmount = calcWage(bp, wageType, wageRate, qty);
      await window.electronAPI.orders.reassignTask(taskId, workerId, wageType, wageRate, wageAmount);
      setAssigningTaskId(null);
      await loadData();
    } catch (err) {
      console.error('Failed to assign:', err);
    }
  };

  const openAssignment = async (taskId: number) => {
    if (assigningTaskId === taskId) {
      setAssigningTaskId(null);
      return;
    }
    const task = tasks.find((t: any) => t.task_id === taskId);
    if (!task) return;
    const pieceType = task.item_piece_type || task.piece_type;
    setAssigningTaskId(taskId);
    try {
      const recs = await window.electronAPI.workers.getRecommended(pieceType, task.task_type);
      setRecommendedForTask(recs || []);
    } catch {
      setRecommendedForTask([]);
    }
  };

  const getRelevantWorkers = (task: any) => {
    const taskType = task.task_type;
    if (taskType === 'cutting') return workers.filter((w: any) => w.worker_type === 'master_cutter');
    return workers.filter((w: any) => w.worker_type === 'tailor' || !w.worker_type);
  };

  const handleStatusChange = async (taskId: number, currentStatus: string) => {
    const next: string | undefined = {
      pending: 'in_progress',
      in_progress: 'done',
    }[currentStatus];
    if (!next) return;
    await window.electronAPI.orders.updateTaskStatus(taskId, next);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading task board...')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">{t('Task Board')}</h1>
        <p className="text-secondary mt-1">{t('Production overview across all orders')}</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="bg-surface-container-lowest rounded-xl p-5">
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Pending')}</span>
          <div className="text-3xl font-extrabold text-on-surface mt-2">{pendingCount}</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5">
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('In Progress')}</span>
          <div className="text-3xl font-extrabold text-primary mt-2">{inProgressCount}</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5">
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Done')}</span>
          <div className="text-3xl font-extrabold text-tertiary mt-2">{doneCount}</div>
        </div>
        <div className="bg-surface-container-lowest rounded-xl p-5">
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Overdue')}</span>
          <div className="text-3xl font-extrabold text-error mt-2">{overdueCount}</div>
        </div>
        <div className={`rounded-xl p-5 ${unassignedCount > 0 ? 'bg-error/5 border-2 border-error/20' : 'bg-surface-container-lowest'}`}>
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Unassigned')}</span>
          <div className={`text-3xl font-extrabold mt-2 ${unassignedCount > 0 ? 'text-error' : 'text-on-surface'}`}>{unassignedCount}</div>
        </div>
      </div>

      <div className="flex gap-4">
        {(isAdmin) && (
          <select
            value={filters.branchId || ''}
            onChange={(e) => setFilters({ ...filters, branchId: e.target.value ? Number(e.target.value) : undefined })}
            className="input-field appearance-none min-w-[160px]"
          >
            <option value="">{t('All Branches')}</option>
            {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name_en || b.name_ar}</option>)}
          </select>
        )}
        <select
          value={filters.workerId || ''}
          onChange={(e) => setFilters({ ...filters, workerId: e.target.value ? Number(e.target.value) : undefined })}
          className="input-field appearance-none min-w-[160px]"
        >
          <option value="">{t('All Workers')}</option>
          {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <select
          value={filters.taskType || ''}
          onChange={(e) => setFilters({ ...filters, taskType: e.target.value || undefined })}
          className="input-field appearance-none min-w-[160px]"
        >
          <option value="">{t('All Types')}</option>
          <option value="cutting">{t('Cutting')}</option>
          <option value="sewing">{t('Sewing')}</option>
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">view_kanban</span>
          <p className="font-headline font-bold text-lg">{t('No tasks found')}</p>
          <p className="text-sm mt-1">{t('Create orders and assign tasks to see them here.')}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Order')}</th>
                <th>{t('Customer')}</th>
                <th>{t('Piece')}</th>
                <th>{t('Qty')}</th>
                <th>{t('Type')}</th>
                <th>{t('Worker')}</th>
                <th>{t('Due Date')}</th>
                {isAdmin && <th>{t('Wage')}</th>}
                <th>{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
                const isUnassigned = !task.assigned_to;
                const isAssigning = assigningTaskId === task.task_id;
                const relevantWorkers = getRelevantWorkers(task);
                const recommended = relevantWorkers.filter((w: any) =>
                  recommendedForTask.some((r: any) => r.user_id === w.id && r.has_rate)
                );
                const others = relevantWorkers.filter((w: any) =>
                  !recommended.some((r: any) => r.user_id === w.id)
                );

                return (
                  <React.Fragment key={task.task_id}>
                    <tr className={isUnassigned ? 'bg-error/5' : isOverdue ? 'bg-error/5' : ''}>
                      <td className="font-bold">{task.order_number}</td>
                      <td className="max-w-[180px]"><span className="truncate block">{task.customer_name || '--'}</span></td>
                      <td className="max-w-[140px]"><span className="truncate block">{task.item_piece_type || task.piece_type}</span></td>
                      <td>{task.task_quantity || 1}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">{TASK_TYPE_ICONS[task.task_type] || 'task'}</span>
                          <span className="capitalize">{task.task_type}</span>
                        </div>
                      </td>
                      <td className="max-w-[160px]">
                        {isUnassigned && isAdmin ? (
                          <button
                            onClick={() => openAssignment(task.task_id)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg flex items-center gap-1 ${
                              isAssigning ? 'bg-surface-container-high text-secondary' : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">{isAssigning ? 'close' : 'person_add'}</span>
                            {isAssigning ? t('Close') : t('Assign')}
                          </button>
                        ) : (
                          <span className="truncate block">{task.worker_name || t('Unassigned')}</span>
                        )}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span>{task.due_date || '--'}</span>
                          {isOverdue && <span className="px-2 py-0.5 bg-error-container text-on-error-container text-xs font-bold rounded-full">{t('Overdue')}</span>}
                        </div>
                      </td>
                      {isAdmin && <td className="font-semibold">{Number(task.wage_amount || 0).toFixed(2)} {t(currency)}</td>}
                      <td>
                        <StatusChip status={task.status} onClick={() => handleStatusChange(task.task_id, task.status)} />
                      </td>
                    </tr>
                    {/* Assignment row */}
                    {isAssigning && (
                      <tr>
                        <td colSpan={isAdmin ? 9 : 8} className="bg-surface-container-low p-0">
                          <div className="p-4 space-y-3">
                            <p className="text-xs font-semibold uppercase tracking-widest text-secondary mb-2">
                              {t('Assign to')}: {task.item_piece_type || task.piece_type} × {task.task_quantity || 1}
                            </p>
                            {recommended.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{t('Recommended')}</p>
                                <div className="flex flex-wrap gap-2">
                                  {recommended.map((w: any) => {
                                    const rec = recommendedForTask.find((r: any) => r.user_id === w.id);
                                    return (
                                      <button
                                        key={w.id}
                                        onClick={() => handleQuickAssign(task.task_id, w.id)}
                                        className="px-3 py-2 rounded-lg text-sm font-semibold bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-2 transition-all"
                                      >
                                        <span className="material-symbols-outlined text-sm">recommend</span>
                                        {w.name}
                                        {rec && <span className="text-xs opacity-70">({rec.rate}{rec.wage_type === 'percentage' ? '%' : ` ${t(currency)}`})</span>}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            {others.length > 0 && (
                              <div className="space-y-1">
                                {recommended.length > 0 && <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('Other Workers')}</p>}
                                <div className="flex flex-wrap gap-2">
                                  {others.map((w: any) => (
                                    <button
                                      key={w.id}
                                      onClick={() => handleQuickAssign(task.task_id, w.id)}
                                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-surface-container-high text-secondary hover:bg-surface-container-highest transition-all"
                                    >
                                      {w.name}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {relevantWorkers.length === 0 && (
                              <p className="text-xs text-secondary">{t('No workers available.')}</p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          <div className="px-6 py-4 border-t border-surface-container-high text-sm text-secondary flex justify-between items-center">
            <p className="text-xs font-medium uppercase tracking-widest">
              {t('Showing')} {tasks.length} {tasks.length !== 1 ? t('tasks') : t('task')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
