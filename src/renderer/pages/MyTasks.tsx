import React, { useState, useEffect, useCallback } from 'react';
import StatusChip from '../components/StatusChip';
import { useTranslation } from '../contexts/I18nContext';

export default function MyTasksPage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [measurements, setMeasurements] = useState<Record<number, any>>({});

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const session = await window.electronAPI.auth.getSession();
      if (!session) return;
      const data = await window.electronAPI.workers.getWorkerTasks(session.userId);
      // Filter tasks by worker type: tailor sees sewing only, cutter sees cutting only
      const taskTypeMap: Record<string, string> = { tailor: 'sewing', master_cutter: 'cutting' };
      const allowedType = taskTypeMap[session.worker_type || ''];
      const filtered = allowedType ? (data || []).filter((t: any) => t.task_type === allowedType) : (data || []);
      setTasks(filtered);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleStatusChange = async (taskId: number, currentStatus: string) => {
    const next = { pending: 'in_progress', in_progress: 'done' }[currentStatus];
    if (!next) return;
    await window.electronAPI.orders.updateTaskStatus(taskId, next);
    await loadTasks();
  };

  const toggleExpand = async (taskId: number, orderId: number) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
      return;
    }
    setExpandedTask(taskId);
    if (!measurements[orderId]) {
      const meas = await window.electronAPI.orders.getMeasurements(orderId);
      setMeasurements((prev) => ({ ...prev, [orderId]: meas }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading tasks...')}
      </div>
    );
  }

  const sorted = [...tasks].sort((a, b) => {
    const order: Record<string, number> = { in_progress: 0, pending: 1, done: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">{t('My Tasks')}</h1>
        <p className="text-secondary mt-1">{t('View and manage your assigned tasks')}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-surface-container-lowest rounded-xl p-6">
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Pending')}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-extrabold text-primary">{tasks.filter((t) => t.status === 'pending').length}</span>
            <span className="text-secondary">{t('tasks')}</span>
          </div>
        </div>
        <div className="bg-surface-container-low rounded-xl p-6">
          <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Completed Today')}</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-extrabold text-primary">{tasks.filter((t) => t.status === 'done' && t.completed_at?.startsWith(today)).length}</span>
            <span className="text-secondary">{t('tasks')}</span>
          </div>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">task_alt</span>
          <p className="font-headline font-bold text-lg">{t('No tasks assigned')}</p>
          <p className="text-sm mt-1">{t('Tasks will appear here when assigned to you.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((task) => {
            const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
            return (
              <div key={task.task_id} className="bg-surface-container-lowest rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <a
                      href={`#/orders/${task.order_id}`}
                      className="font-headline font-bold text-primary hover:underline"
                    >
                      {task.order_number}
                    </a>
                    <span className="text-secondary">{task.piece_type}</span>
                    {isOverdue && <span className="px-2 py-0.5 bg-error-container text-on-error-container text-xs font-bold rounded-full">{t('Overdue')}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {task.due_date && <span className="text-xs text-secondary">{t('Due:')}: {task.due_date}</span>}
                    <StatusChip status={task.status} onClick={() => handleStatusChange(task.task_id, task.status)} />
                  </div>
                </div>
                {task.notes && <p className="text-sm text-secondary mt-2">{task.notes}</p>}
                <div className="flex items-center gap-3 mt-3">
                  <button
                    onClick={() => toggleExpand(task.task_id, task.order_id)}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    {expandedTask === task.task_id ? t('Hide Measurements') : t('View Measurements')}
                  </button>
                  {task.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(task.task_id, 'pending')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      {t('Start')}
                    </button>
                  )}
                  {task.status === 'in_progress' && (
                    <button
                      onClick={() => handleStatusChange(task.task_id, 'in_progress')}
                      className="text-xs text-primary font-semibold hover:underline"
                    >
                      {t('Mark Done')}
                    </button>
                  )}
                </div>
                {expandedTask === task.task_id && measurements[task.order_id] && (
                  <div className="mt-3 bg-surface rounded-lg p-4 grid grid-cols-3 gap-3 text-sm">
                    {['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder'].map((f) => (
                      <div key={f}>
                        <span className="text-secondary text-xs uppercase">{t(f)}</span>
                        <span className="block font-semibold">{measurements[task.order_id][f] || '--'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
