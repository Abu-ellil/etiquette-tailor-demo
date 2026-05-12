import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../contexts/I18nContext';

export default function CuttingQueuePage() {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const session = await window.electronAPI.auth.getSession();
      if (!session) return;
      const data = await window.electronAPI.workers.getWorkerTasks(session.userId);
      const cuttingTasks = (data || []).filter((t: any) => t.task_type === 'cutting');
      const sorted = cuttingTasks.sort((a: any, b: any) => {
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
      setTasks(sorted);
    } catch (err) {
      console.error('Failed to load cutting queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleDone = async (taskId: number) => {
    await window.electronAPI.orders.updateTaskStatus(taskId, 'done');
    await loadTasks();
  };

  const today = new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading cutting queue...')}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">{t('Cutting Queue')}</h1>
        <p className="text-secondary mt-1">{t("Today's cutting tasks sorted by delivery date")}</p>
      </div>

      <div className="bg-surface-container-lowest rounded-xl p-6">
        <span className="text-xs font-bold tracking-widest uppercase text-secondary">{t('Pending Cuts')}</span>
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-4xl font-extrabold text-primary">{tasks.filter((t) => t.status !== 'done').length}</span>
          <span className="text-secondary">{t('pieces')}</span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">content_cut</span>
          <p className="font-headline font-bold text-lg">{t('No cutting tasks')}</p>
          <p className="text-sm mt-1">{t('Cutting tasks will appear here when assigned.')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isOverdue = task.due_date && task.due_date < today && task.status !== 'done';
            const isDone = task.status === 'done';
            return (
              <div key={task.task_id} className={`bg-surface-container-lowest rounded-xl p-5 ${isDone ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-headline font-bold text-on-surface">{task.order_number}</span>
                    <span className="text-secondary">{task.piece_type}</span>
                    {isOverdue && <span className="px-2 py-0.5 bg-error-container text-on-error-container text-xs font-bold rounded-full">{t('Overdue')}</span>}
                  </div>
                  <div className="flex items-center gap-3">
                    {task.due_date && <span className="text-xs text-secondary">{t('Due:')}: {task.due_date}</span>}
                    {!isDone && (
                      <button
                        onClick={() => handleDone(task.task_id)}
                        className="px-4 py-1.5 bg-tertiary-fixed text-on-tertiary-fixed rounded-full text-xs font-bold hover:opacity-80 transition-colors"
                      >
                        {t('Done')}
                      </button>
                    )}
                    {isDone && (
                      <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed rounded-full text-xs font-bold">{t('Completed')}</span>
                    )}
                  </div>
                </div>
                {task.notes && <p className="text-sm text-secondary mt-2">{task.notes}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
