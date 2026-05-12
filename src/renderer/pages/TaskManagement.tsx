import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../contexts/I18nContext';

interface Task {
  task_id: number;
  order_id: number;
  order_number: string;
  piece_type: string;
  item_piece_type?: string;
  task_quantity?: number;
  base_price?: number;
  details?: string;
  task_type: string;
  status: string;
  assigned_to?: number;
  worker_name?: string;
  wage_type?: string;
  wage_rate?: number;
  wage_amount?: number;
  due_date?: string;
  customer_name?: string;
  order_price?: number;
}

interface Workload {
  user_id: number;
  worker_name: string;
  worker_type: string | null;
  pending_count: number;
  in_progress_count: number;
  total_active: number;
}

interface RecommendedWorker {
  user_id: number;
  worker_name: string;
  worker_type: string | null;
  has_rate: boolean;
  rate: number;
  wage_type: string;
  active_tasks: number;
}

export default function TaskManagementPage() {
  const { t, currency } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workloads, setWorkloads] = useState<Workload[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterBranch, setFilterBranch] = useState<number | null>(null);
  const [filterWorker, setFilterWorker] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Assign modal
  const [assignModal, setAssignModal] = useState<{ task: Task; recommended: RecommendedWorker[] } | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [calculatedWage, setCalculatedWage] = useState<number>(0);
  const [calculatedWageType, setCalculatedWageType] = useState<string>('percentage');
  const [calculatedWageRate, setCalculatedWageRate] = useState<number>(0);
  const [assigning, setAssigning] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (filterBranch) filters.branchId = filterBranch;
      if (filterWorker) filters.workerId = filterWorker;
      if (filterType) filters.taskType = filterType;

      const [tasksData, workloadsData, branchesData] = await Promise.all([
        window.electronAPI.orders.getAllTasks(Object.keys(filters).length > 0 ? filters : undefined),
        window.electronAPI.workers.getWorkloads(filterBranch || undefined),
        window.electronAPI.branches.getAll(),
      ]);
      setTasks((tasksData || []) as Task[]);
      setWorkloads((workloadsData || []) as Workload[]);
      setBranches(branchesData || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [filterBranch, filterWorker, filterType]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter tasks client-side for status and search
  const filteredTasks = tasks.filter((task) => {
    if (filterStatus && task.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match = (task.order_number || '').toLowerCase().includes(q)
        || (task.customer_name || '').toLowerCase().includes(q)
        || (task.item_piece_type || task.piece_type || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Summary counts
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const overdueCount = tasks.filter((t) => t.status !== 'done' && t.due_date && new Date(t.due_date) < new Date()).length;

  // Assign modal
  const openAssignModal = async (task: Task) => {
    try {
      const recommended = await window.electronAPI.workers.getRecommended(task.item_piece_type || task.piece_type, task.task_type);
      setAssignModal({ task, recommended: (recommended || []) as RecommendedWorker[] });
      setSelectedWorkerId(task.assigned_to || null);
      setCalculatedWage(task.wage_amount || 0);
      setCalculatedWageType(task.wage_type || 'percentage');
      setCalculatedWageRate(task.wage_rate || 0);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  };

  const handleWorkerSelect = (workerId: number) => {
    setSelectedWorkerId(workerId);
    const rec = assignModal?.recommended.find((r) => r.user_id === workerId);
    if (rec && rec.has_rate) {
      setCalculatedWageType(rec.wage_type);
      setCalculatedWageRate(rec.rate);
      const quantity = assignModal?.task.task_quantity || 1;
      const price = assignModal?.task.base_price || assignModal?.task.order_price || 0;
      setCalculatedWage(rec.wage_type === 'percentage' ? price * (rec.rate / 100) * quantity : rec.rate);
    }
  };

  const handleAssign = async () => {
    if (!assignModal || !selectedWorkerId) return;
    try {
      setAssigning(true);
      await window.electronAPI.orders.reassignTask(
        assignModal.task.task_id,
        selectedWorkerId,
        calculatedWageType,
        calculatedWageRate,
        calculatedWage,
      );
      setAssignModal(null);
      await loadData();
    } catch (err) {
      console.error('Failed to reassign task:', err);
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (taskId: number, status: string) => {
    try {
      await window.electronAPI.orders.updateTaskStatus(taskId, status);
      await loadData();
    } catch (err) {
      console.error('Failed to update task status:', err);
    }
  };

  const maxWorkload = Math.max(...workloads.map((w) => w.total_active), 1);

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
      <div>
        <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
          {t('Task Management')}
        </h1>
        <p className="text-secondary mt-1 text-lg">
          {t('Advanced task assignment and workload management')}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-28">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Pending')}</span>
          <span className="text-3xl font-extrabold text-on-surface-variant">{pendingCount}</span>
        </div>
        <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between h-28">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('In Progress')}</span>
          <span className="text-3xl font-extrabold text-primary">{inProgressCount}</span>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-28">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Done')}</span>
          <span className="text-3xl font-extrabold text-tertiary">{doneCount}</span>
        </div>
        <div className="bg-error-container p-6 rounded-xl text-white flex flex-col justify-between h-28">
          <span className="text-white/80 font-headline text-xs font-bold uppercase tracking-widest">{t('Overdue')}</span>
          <span className="text-3xl font-extrabold">{overdueCount}</span>
        </div>
      </div>

      {/* Workload Balance */}
      {workloads.length > 0 && (
        <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-container-high">
            <h2 className="text-lg font-headline font-bold text-on-surface">{t('Workload Balance')}</h2>
          </div>
          <div className="p-6 space-y-3">
            {workloads.map((w) => (
              <div key={w.user_id} className="flex items-center gap-4">
                <span className="text-sm font-semibold text-on-surface w-36 truncate">{w.worker_name}</span>
                <div className="flex-1 flex gap-1 items-center">
                  <div className="h-7 bg-surface-container rounded-full overflow-hidden flex-1 flex">
                    {w.in_progress_count > 0 && (
                      <div
                        className="h-full bg-primary transition-all flex items-center justify-center"
                        style={{ width: `${(w.in_progress_count / maxWorkload) * 100}%`, minWidth: w.in_progress_count > 0 ? '20px' : '0' }}
                      >
                        {w.in_progress_count > 0 && <span className="text-white text-[10px] font-bold">{w.in_progress_count}</span>}
                      </div>
                    )}
                    {w.pending_count > 0 && (
                      <div
                        className="h-full bg-surface-container-high transition-all flex items-center justify-center"
                        style={{ width: `${(w.pending_count / maxWorkload) * 100}%`, minWidth: w.pending_count > 0 ? '20px' : '0' }}
                      >
                        {w.pending_count > 0 && <span className="text-on-surface-variant text-[10px] font-bold">{w.pending_count}</span>}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-secondary ml-2 shrink-0">
                    {w.total_active} {t('active tasks')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {branches.length > 1 && (
          <div>
            <select
              value={filterBranch || ''}
              onChange={(e) => setFilterBranch(Number(e.target.value) || null)}
              className="input-field text-sm py-2 appearance-none pr-8"
            >
              <option value="">{t('All Branches')}</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name_en}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="input-field text-sm py-2 appearance-none pr-8"
          >
            <option value="">{t('All Types')}</option>
            <option value="cutting">{t('cutting')}</option>
            <option value="sewing">{t('sewing')}</option>
          </select>
        </div>
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field text-sm py-2 appearance-none pr-8"
          >
            <option value="">{t('All Statuses')}</option>
            <option value="pending">{t('Pending')}</option>
            <option value="in_progress">{t('In Progress')}</option>
            <option value="done">{t('Done')}</option>
          </select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-10 text-sm py-2"
            placeholder={t('Search by order or customer...')}
          />
        </div>
      </div>

      {/* Tasks Table */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3 text-outline">task_alt</span>
            <p className="font-headline font-bold text-on-surface text-lg">{t('No tasks found')}</p>
            <p className="text-sm mt-1">{t('Create orders and assign tasks to see them here.')}</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 border-b border-surface-container-high text-xs text-secondary">
              {t('Showing {count} task(s)').replace('{count}', String(filteredTasks.length))}
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Order')}</th>
                    <th>{t('Customer')}</th>
                    <th>{t('Piece Type')}</th>
                    <th>{t('Qty')}</th>
                    <th>{t('Task Type')}</th>
                    <th>{t('Worker')}</th>
                    <th>{t('Due Date')}</th>
                    <th>{t('Wage')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((task) => {
                    const isOverdue = task.status !== 'done' && task.due_date && new Date(task.due_date) < new Date();
                    return (
                      <tr key={task.task_id} className={isOverdue ? 'bg-error/5' : ''}>
                        <td className="font-semibold">{task.order_number}</td>
                        <td className="text-secondary">{task.customer_name || '--'}</td>
                        <td>{task.item_piece_type || task.piece_type}</td>
                        <td>{task.task_quantity || 1}</td>
                        <td>
                          <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full capitalize">
                            {t(task.task_type)}
                          </span>
                        </td>
                        <td>
                          {task.worker_name ? (
                            <span className="font-medium">{task.worker_name}</span>
                          ) : (
                            <span className="text-secondary italic">{t('Unassigned')}</span>
                          )}
                        </td>
                        <td className={isOverdue ? 'text-error font-semibold' : 'text-secondary'}>
                          {task.due_date || '--'}
                        </td>
                        <td className="text-sm">
                          {task.wage_amount ? (
                            <span className="font-semibold text-primary">{Number(task.wage_amount).toFixed(0)} {t(currency)}</span>
                          ) : '--'}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full capitalize ${
                            task.status === 'done' ? 'bg-tertiary/10 text-tertiary' :
                            task.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                            'bg-surface-container-high text-on-surface-variant'
                          }`}>
                            {t(task.status === 'in_progress' ? 'In Progress' : task.status === 'done' ? 'Done' : 'Pending')}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {task.status === 'pending' && (
                              <button
                                onClick={() => handleStatusChange(task.task_id, 'in_progress')}
                                className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title={t('Start')}
                              >
                                <span className="material-symbols-outlined text-lg">play_arrow</span>
                              </button>
                            )}
                            {task.status === 'in_progress' && (
                              <button
                                onClick={() => handleStatusChange(task.task_id, 'done')}
                                className="p-1.5 text-tertiary hover:bg-tertiary/10 rounded-lg transition-colors"
                                title={t('Mark Done')}
                              >
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                              </button>
                            )}
                            <button
                              onClick={() => openAssignModal(task)}
                              className="p-1.5 text-on-surface-variant hover:bg-surface-container-high rounded-lg transition-colors"
                              title={t('Assign Worker')}
                            >
                              <span className="material-symbols-outlined text-lg">person_add</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Assign Worker Modal */}
      {assignModal && (
        <div className="modal-backdrop" onClick={() => setAssignModal(null)}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-6 md:px-8 md:py-8">
                {/* Modal Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-white">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>person_add</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-headline font-extrabold text-on-surface">{t('Assign Worker')}</h2>
                      <p className="text-secondary text-xs mt-0.5">
                        {assignModal.task.order_number} - {assignModal.task.item_piece_type || assignModal.task.piece_type} ({t(assignModal.task.task_type)})
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setAssignModal(null)} className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Recommended Workers */}
                {assignModal.recommended.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-primary text-lg">lightbulb</span>
                      <span className="text-xs font-headline font-bold uppercase tracking-widest text-secondary">{t('Worker Recommendation')}</span>
                    </div>
                    <div className="space-y-2">
                      {assignModal.recommended.slice(0, 3).map((r) => (
                        <button
                          key={r.user_id}
                          onClick={() => handleWorkerSelect(r.user_id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                            selectedWorkerId === r.user_id
                              ? 'bg-primary-container/10 border-2 border-primary-container'
                              : 'bg-surface-container hover:bg-surface-container-high'
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold">
                            {r.worker_name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-on-surface text-sm truncate">{r.worker_name}</p>
                            <div className="flex items-center gap-2 text-xs text-secondary">
                              {r.has_rate ? (
                                <span>{r.wage_type === 'percentage' ? `${r.rate}%` : `${r.rate} ${t(currency)}`}</span>
                              ) : (
                                <span className="text-error">{t('No rate set')}</span>
                              )}
                              <span>-</span>
                              <span>{r.active_tasks} {t('active tasks')}</span>
                            </div>
                          </div>
                          {r.has_rate && r.active_tasks <= 2 && (
                            <span className="px-2 py-0.5 bg-tertiary/10 text-tertiary text-[10px] font-bold rounded-full uppercase">{t('Recommended')}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Worker Selector */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">{t('Worker')}</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">person</span>
                      <select
                        value={selectedWorkerId || ''}
                        onChange={(e) => handleWorkerSelect(Number(e.target.value))}
                        className="input-field pl-12 appearance-none"
                      >
                        <option value="">{t('Select a worker to assign...')}</option>
                        {assignModal.recommended.map((r) => (
                          <option key={r.user_id} value={r.user_id}>
                            {r.worker_name} {r.has_rate ? `(${r.wage_type === 'percentage' ? `${r.rate}%` : `${r.rate} ${t(currency)}`})` : `(${t('No rate set')})`}
                          </option>
                        ))}
                      </select>
                      <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">expand_more</span>
                    </div>
                  </div>

                  {/* Wage Display */}
                  {selectedWorkerId && (
                    <div className="bg-surface-container rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-sm">payments</span>
                        <span className="text-xs font-bold text-secondary uppercase tracking-widest">{t('Worker Pay')}</span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-extrabold text-primary">{calculatedWage.toFixed(0)}</span>
                        <span className="text-secondary">{t(currency)}</span>
                        <span className="text-xs text-secondary ml-2">
                          ({calculatedWageType === 'percentage' ? `${calculatedWageRate}%` : `${calculatedWageRate} ${t(currency)} ${t('Fixed')}`})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-6">
                  <button onClick={() => setAssignModal(null)} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors">
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={assigning || !selectedWorkerId}
                    className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {assigning && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
                    {assigning ? t('Saving...') : t('Assign')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
