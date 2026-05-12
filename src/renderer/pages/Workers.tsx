import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { format, parseISO } from 'date-fns';
import { useTranslation } from '../contexts/I18nContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Worker {
  id: number;
  name: string;
  username: string;
  role: string;
  worker_type?: 'tailor' | 'master_cutter' | null;
  branch_id: number;
  base_salary: number;
  default_rate: number;
  active: number;
  created_at?: string;
}

interface WorkerFormValues {
  name: string;
  username: string;
  password: string;
  worker_type: string;
  branch_id: number;
  base_salary: number;
  default_rate: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AVATAR_COLORS = [
  'bg-secondary-container text-on-secondary-container',
  'bg-primary-fixed text-on-primary-fixed',
  'bg-tertiary-fixed text-on-tertiary-fixed',
  'bg-outline-variant text-on-surface-variant',
  'bg-surface-container-high text-on-surface-variant',
];

const WORKER_TYPE_ICONS: Record<string, string> = {
  tailor: 'styler',
  master_cutter: 'content_cut',
};

const EMPLOYMENT_BADGES: Record<string, { bg: string; text: string }> = {
  permanent: {
    bg: 'bg-tertiary-fixed',
    text: 'text-on-tertiary-fixed',
  },
  seasonal: {
    bg: 'bg-primary-fixed',
    text: 'text-on-primary-fixed',
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAvatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed.slice(0, 2);
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--';
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy');
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WorkersPage() {
  const { t, currency } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [workerEarnings, setWorkerEarnings] = useState<Record<number, any>>({});
  const [expandedEarnings, setExpandedEarnings] = useState<Record<number, boolean>>({});
  const [expandedOrderDetails, setExpandedOrderDetails] = useState<Record<number, boolean>>({});
  const [orderDetailDateRange, setOrderDetailDateRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });
  const [workerOrderDetails, setWorkerOrderDetails] = useState<Record<number, any[]>>({});
  const [paymentModalWorker, setPaymentModalWorker] = useState<Worker | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkerFormValues>();

  /* ---- Data loading ---- */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [workersData, branchesData] = await Promise.all([
        window.electronAPI.workers.getAll(),
        window.electronAPI.branches.getAll(),
      ]);
      setWorkers(workersData || []);
      setBranches(branchesData || []);
    } catch (err) {
      console.error('Failed to load workers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    async function loadEarnings() {
      const earningsMap: Record<number, any> = {};
      for (const w of workers) {
        try {
          const data = await window.electronAPI.workers.getMonthlyEarnings(w.id, selectedMonth);
          earningsMap[w.id] = data;
        } catch {
          earningsMap[w.id] = { task_count: 0, piece_earnings: 0, fixed_salary: 0, total_earnings: 0 };
        }
      }
      setWorkerEarnings(earningsMap);
    }
    if (workers.length > 0) loadEarnings();
  }, [workers, selectedMonth]);

  /* ---- Order detail breakdown loading ---- */

  const loadOrderDetails = useCallback(async (workerId: number) => {
    try {
      const data = await window.electronAPI.workers.getWorkerOrderDetails(
        workerId,
        orderDetailDateRange.start,
        orderDetailDateRange.end + 'T23:59:59',
      );
      setWorkerOrderDetails((prev) => ({ ...prev, [workerId]: data || [] }));
    } catch (err) {
      console.error('Failed to load order details:', err);
    }
  }, [orderDetailDateRange]);

  const toggleOrderDetails = (workerId: number) => {
    const nextExpanded = !expandedOrderDetails[workerId];
    setExpandedOrderDetails((prev) => ({ ...prev, [workerId]: nextExpanded }));
    if (nextExpanded && !workerOrderDetails[workerId]) {
      loadOrderDetails(workerId);
    }
  };

  /* ---- Derived stats ---- */

  const activeCount = workers.filter((w) => w.active === 1).length;
  const totalCount = workers.length;
  const permanentCount = workers.filter((w) => w.base_salary > 0).length;
  const seasonalCount = totalCount - permanentCount;

  /* ---- Modal helpers ---- */

  const openAddModal = () => {
    setEditingWorker(null);
    reset({
      name: '',
      username: '',
      password: '',
      worker_type: 'tailor',
      branch_id: branches.length > 0 ? branches[0].id : 1,
      base_salary: 0,
      default_rate: 0,
    });
    setModalOpen(true);
  };

  const openEditModal = (worker: Worker) => {
    setEditingWorker(worker);
    reset({
      name: worker.name,
      username: worker.username,
      password: '',
      worker_type: worker.worker_type || 'tailor',
      branch_id: worker.branch_id,
      base_salary: worker.base_salary || 0,
      default_rate: worker.default_rate || 0,
    });
    setModalOpen(true);
    setActionMenuId(null);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingWorker(null);
    setShowPassword(false);
    reset({
      name: '',
      username: '',
      password: '',
      worker_type: 'tailor',
      branch_id: 1,
      base_salary: 0,
      default_rate: 0,
    });
  };

  /* ---- Form submit ---- */

  const onSubmit = async (data: WorkerFormValues) => {
    try {
      if (editingWorker) {
        const updateData: any = {
          name: data.name,
          worker_type: data.worker_type || null,
          branch_id: data.branch_id,
          base_salary: Number(data.base_salary) || 0,
          default_rate: Number(data.default_rate) || 0,
        };
        if (data.password) {
          updateData.password = data.password;
        }
        await window.electronAPI.users.update(editingWorker.id, updateData);
      } else {
        await window.electronAPI.users.create({
          name: data.name,
          username: data.username,
          password: data.password,
          role: 'worker',
          worker_type: data.worker_type || null,
          branch_id: data.branch_id,
          base_salary: Number(data.base_salary) || 0,
          default_rate: Number(data.default_rate) || 0,
        });
      }
      closeModal();
      await loadData();
    } catch (err) {
      console.error('Failed to save worker:', err);
    }
  };

  /* ---- Deactivate ---- */

  const handleDeactivate = async (worker: Worker) => {
    if (
      !window.confirm(
        t('Deactivate worker "{name}"?').replace('{name}', worker.name),
      )
    )
      return;
    try {
      await window.electronAPI.users.deactivate(worker.id);
      await loadData();
    } catch (err) {
      console.error('Failed to deactivate worker:', err);
    }
    setActionMenuId(null);
  };

  /* ---- Payment recording ---- */

  const openPaymentModal = (worker: Worker) => {
    setPaymentModalWorker(worker);
    setPaymentAmount('');
    setPaymentNote('');
    setActionMenuId(null);
  };

  const closePaymentModal = () => {
    setPaymentModalWorker(null);
    setPaymentAmount('');
    setPaymentNote('');
    setPaymentSubmitting(false);
  };

  const handleRecordPayment = async () => {
    if (!paymentModalWorker || !paymentAmount || Number(paymentAmount) <= 0) return;
    try {
      setPaymentSubmitting(true);
      await window.electronAPI.workers.addPayment(
        paymentModalWorker.id,
        Number(paymentAmount),
        paymentNote || null,
      );
      closePaymentModal();
      await loadData();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  /* ---- Click-away for action menu ---- */

  useEffect(() => {
    if (actionMenuId === null) return;
    const handler = () => setActionMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [actionMenuId]);

  /* ---- Render ---- */

  return (
    <div className="space-y-10">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            {t('Workers')}
          </h1>
          <p className="text-secondary mt-1 text-lg">
            {t('Manage your artisan team and seasonal specialists.')}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary flex items-center gap-3 py-4 px-11 text-sm shadow-xl hover:opacity-90 transition-opacity active:scale-95"
        >
          <span className="material-symbols-outlined">person_add</span>
          {t('Add Worker')}
        </button>
      </div>

      {/* ---- Stats Overview ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Active Force */}
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-40">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">
            {t('Active Force')}
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-extrabold text-primary">{activeCount}</span>
            <span className="text-secondary font-medium">{t('Artisans')}</span>
          </div>
        </div>

        {/* Production Type */}
        <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between h-40">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">
            {t('Production Type')}
          </span>
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-on-surface">{permanentCount}</span>
              <span className="text-[10px] text-secondary uppercase font-bold tracking-tighter">
                {t('Permanent')}
              </span>
            </div>
            <div className="w-px h-full bg-outline-variant/30" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-on-surface">{seasonalCount}</span>
              <span className="text-[10px] text-secondary uppercase font-bold tracking-tighter">
                {t('Seasonal')}
              </span>
            </div>
          </div>
        </div>

        {/* Month Earnings */}
        <div className="bg-primary-container p-8 rounded-xl text-white flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span className="text-white/80 font-headline text-xs font-bold uppercase tracking-widest">
              {t('Monthly Earnings')}
            </span>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-surface-container-lowest/20 text-white text-xs px-2 py-1 rounded border-none outline-none cursor-pointer"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-4xl">payments</span>
            <div>
              <span className="text-xl font-bold">
                {Object.values(workerEarnings).reduce((sum: number, e: any) => sum + (e?.total_earnings || 0), 0).toFixed(0)} {t(currency)}
              </span>
              <p className="text-white/70 text-xs">{selectedMonth}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ---- Workers Table ---- */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-x-auto overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-secondary">
            <span className="material-symbols-outlined animate-spin mr-2">
              progress_activity
            </span>
            {t('Loading workers...')}
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3 text-outline">badge</span>
            <p className="font-headline font-bold text-on-surface text-lg">{t('No workers found')}</p>
            <p className="text-sm mt-1">{t('Add your first worker to get started.')}</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Worker Name')}</th>
                <th>{t('Employment Type')}</th>
                <th>{t('Payment Structure')}</th>
                <th>{t('Monthly Earnings')}</th>
                <th>{t('Join Date')}</th>
                <th className="text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => {
                const empType = worker.base_salary > 0 ? 'permanent' : 'seasonal';
                const badge = EMPLOYMENT_BADGES[empType];
                const typeIcon =
                  WORKER_TYPE_ICONS[worker.worker_type || 'tailor'] || 'badge';

                return (
                  <tr key={worker.id}>
                    {/* Name + Avatar */}
                    <td>
                      <div className="flex items-center gap-4 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColor(worker.id)}`}
                        >
                          {getInitials(worker.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-on-surface truncate">{worker.name}</p>
                          <p className="text-xs text-secondary">
                            {worker.worker_type === 'master_cutter' ? t('Master Cutter') : worker.worker_type === 'tailor' ? t('Tailor') : t('Worker')}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Employment Type */}
                    <td>
                      <span
                        className={`px-3 py-1 ${badge.bg} ${badge.text} text-[11px] font-bold uppercase rounded-full`}
                      >
                        {t(empType)}
                      </span>
                    </td>

                    {/* Payment Structure */}
                    <td>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-on-surface-variant font-medium">
                          <span className="material-symbols-outlined text-lg opacity-40">
                            {worker.base_salary > 0 ? 'account_balance_wallet' : 'percent'}
                          </span>
                          {worker.base_salary > 0 ? t('Fixed Salary') : t('Piece-rate')}
                        </div>
                        {worker.default_rate > 0 && (
                          <span className="text-[11px] text-primary font-semibold">
                            {worker.default_rate}% {t('rate')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Monthly Earnings */}
                    <td>
                      {workerEarnings[worker.id] && (
                        <div>
                          <div
                            onClick={() => setExpandedEarnings((prev) => ({ ...prev, [worker.id]: !prev[worker.id] }))}
                            className="text-left cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedEarnings((prev) => ({ ...prev, [worker.id]: !prev[worker.id] })); }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-primary">
                                {(workerEarnings[worker.id]?.total_earnings || 0).toFixed(0)} {t(currency)}
                              </span>
                              <span className="material-symbols-outlined text-xs text-secondary">
                                {expandedEarnings[worker.id] ? 'expand_less' : 'expand_more'}
                              </span>
                            </div>
                            <p className="text-[10px] text-secondary">
                              {workerEarnings[worker.id]?.task_count || 0} {t('tasks')}
                            </p>
                            {expandedEarnings[worker.id] && (
                              <div className="mt-2 p-2 bg-surface-container rounded text-xs space-y-1 min-w-[160px]">
                                <div className="flex justify-between">
                                  <span className="text-secondary">{t('Piece Earnings')}</span>
                                  <span className="font-semibold">{(workerEarnings[worker.id]?.piece_earnings || 0).toFixed(0)} {t(currency)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-secondary">{t('Fixed Salary')}</span>
                                  <span className="font-semibold">{(workerEarnings[worker.id]?.fixed_salary || 0).toFixed(0)} {t(currency)}</span>
                                </div>
                                <div className="flex justify-between border-t border-outline-variant/20 pt-1">
                                  <span className="font-bold">{t('Total')}</span>
                                  <span className="font-bold text-primary">{(workerEarnings[worker.id]?.total_earnings || 0).toFixed(0)} {t(currency)}</span>
                                </div>
                                {/* Order-level breakdown toggle */}
                                <div className="border-t border-outline-variant/20 pt-1 mt-1">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleOrderDetails(worker.id); }}
                                    className="flex items-center gap-1 text-primary font-semibold hover:underline text-[10px]"
                                  >
                                    <span className="material-symbols-outlined text-xs">
                                      {expandedOrderDetails[worker.id] ? 'expand_less' : 'expand_more'}
                                    </span>
                                    {t('Order Details')}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                          {expandedOrderDetails[worker.id] && expandedEarnings[worker.id] && (
                            <div className="mt-2 border border-outline-variant/20 rounded-lg overflow-hidden">
                              <div className="flex items-center gap-2 p-2 bg-surface-container-high">
                                <input
                                  type="date"
                                  value={orderDetailDateRange.start}
                                  onChange={(e) => setOrderDetailDateRange((prev) => ({ ...prev, start: e.target.value }))}
                                  className="bg-surface-container-lowest text-xs px-2 py-1 rounded border-none outline-none"
                                />
                                <span className="text-secondary text-xs">{t('to')}</span>
                                <input
                                  type="date"
                                  value={orderDetailDateRange.end}
                                  onChange={(e) => setOrderDetailDateRange((prev) => ({ ...prev, end: e.target.value }))}
                                  className="bg-surface-container-lowest text-xs px-2 py-1 rounded border-none outline-none"
                                />
                                <button
                                  onClick={() => loadOrderDetails(worker.id)}
                                  className="text-xs text-primary font-bold hover:underline"
                                >
                                  {t('Apply')}
                                </button>
                              </div>
                              {workerOrderDetails[worker.id] ? (
                                workerOrderDetails[worker.id].length === 0 ? (
                                  <p className="text-xs text-secondary p-3">{t('No completed tasks in this period.')}</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="bg-surface-container text-secondary">
                                        <th className="px-2 py-1 text-left font-semibold">{t('Order')}</th>
                                        <th className="px-2 py-1 text-left font-semibold">{t('Piece')}</th>
                                        <th className="px-2 py-1 text-right font-semibold">{t('Price')}</th>
                                        <th className="px-2 py-1 text-right font-semibold">{t('Wage')}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {workerOrderDetails[worker.id].map((d: any) => (
                                        <tr key={d.task_id} className="border-t border-outline-variant/10">
                                          <td className="px-2 py-1 font-semibold">{d.order_number}</td>
                                          <td className="px-2 py-1 text-secondary">{d.piece_type}</td>
                                          <td className="px-2 py-1 text-right">{Number(d.price).toFixed(0)} {t(currency)}</td>
                                          <td className="px-2 py-1 text-right font-semibold text-primary">{Number(d.wage_amount).toFixed(0)} {t(currency)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )
                              ) : (
                                <p className="text-xs text-secondary p-3">{t('Loading...')}</p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Join Date */}
                    <td className="text-secondary text-sm">
                      {formatDate(worker.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (actionMenuId === worker.id) {
                              setActionMenuId(null);
                              setActionMenuPos(null);
                            } else {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const up = window.innerHeight - rect.bottom < 120;
                              setActionMenuPos({
                                top: up ? rect.top - 4 : rect.bottom + 4,
                                right: window.innerWidth - rect.right,
                                up,
                              });
                              setActionMenuId(worker.id);
                            }
                          }}
                          className="text-outline hover:text-primary transition-colors p-1"
                        >
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>

                        {actionMenuId === worker.id && actionMenuPos && (
                          <div
                            className="fixed bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/20 z-50 min-w-[160px] py-1"
                            style={{
                              top: actionMenuPos.top,
                              right: actionMenuPos.right,
                              transform: actionMenuPos.up ? 'translateY(-100%)' : undefined,
                            }}
                          >
                            <button
                              onClick={() => openEditModal(worker)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container transition-colors flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-base">edit</span>
                              {t('Edit Worker')}
                            </button>
                            <button
                              onClick={() => openPaymentModal(worker)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container transition-colors flex items-center gap-2 text-primary"
                            >
                              <span className="material-symbols-outlined text-base">payments</span>
                              {t('Record Payment')}
                            </button>
                            <button
                              onClick={() => handleDeactivate(worker)}
                              className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container transition-colors flex items-center gap-2 text-error"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                              {t('Deactivate')}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Table Footer */}
        {workers.length > 0 && (
          <div className="px-6 py-4 border-t border-surface-container-high text-sm text-secondary flex justify-between items-center">
            <p className="text-xs font-medium uppercase tracking-widest">
              {t('Showing {count} artisan(s)').replace('{count}', String(workers.length))}
            </p>
          </div>
        )}
      </div>

      {/* ---- Add / Edit Modal ---- */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-content w-full max-w-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-6 md:px-8 md:py-8">
                {/* Modal Header */}
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-white">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {editingWorker ? 'edit' : 'person_add'}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
                        {editingWorker ? t('Edit Worker') : t('New Worker')}
                      </h2>
                      <p className="text-secondary text-xs mt-0.5">
                        {editingWorker
                          ? t('Update worker information')
                          : t('Add an artisan to the team')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Section: Personal Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-lg">badge</span>
                      <span className="text-xs font-headline font-bold uppercase tracking-widest text-secondary">
                        {t('Personal Information')}
                      </span>
                    </div>

                    {/* Full Name */}
                    <div>
                      <label
                        className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                        htmlFor="worker-name"
                      >
                        {t('Full Name')}
                      </label>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-4 text-outline">
                          person
                        </span>
                        <input
                          {...register('name', { required: t('Name is required') })}
                          id="worker-name"
                          type="text"
                          className={`input-field pl-12 ${errors.name ? '!border-b-error' : ''}`}
                          placeholder={t('e.g. Ahmad Ali / أحمد علي')}
                        />
                      </div>
                      {errors.name && (
                        <p className="text-error text-xs mt-1 ml-1">{errors.name.message}</p>
                      )}
                    </div>

                    {/* Username + Password side by side */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                          htmlFor="worker-username"
                        >
                          {t('Username')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">
                            alternate_email
                          </span>
                          <input
                            {...register('username', {
                              required: !editingWorker ? t('Username is required') : false,
                            })}
                            id="worker-username"
                            type="text"
                            className={`input-field pl-12 ${errors.username ? '!border-b-error' : ''}`}
                            placeholder={t('Login ID')}
                            disabled={!!editingWorker}
                          />
                        </div>
                        {errors.username && (
                          <p className="text-error text-xs mt-1 ml-1">{errors.username.message}</p>
                        )}
                      </div>

                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                          htmlFor="worker-password"
                        >
                          {editingWorker ? t('New Password') : t('Password')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">
                            lock
                          </span>
                          <input
                            {...register('password', {
                              required: !editingWorker ? t('Password is required') : false,
                            })}
                            id="worker-password"
                            type={showPassword ? 'text' : 'password'}
                            className={`input-field pl-12 pr-12 ${errors.password ? '!border-b-error' : ''}`}
                            placeholder={editingWorker ? t('Leave blank to keep') : t('Min 6 characters')}
                          />
                          <button
                            type="button"
                            className="absolute right-4 text-outline hover:text-primary transition-colors"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                          >
                            <span className="material-symbols-outlined">
                              {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-error text-xs mt-1 ml-1">{errors.password.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-outline-variant/20" />

                  {/* Section: Work Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-lg">work</span>
                      <span className="text-xs font-headline font-bold uppercase tracking-widest text-secondary">
                        {t('Work Details')}
                      </span>
                    </div>

                    {/* Specialty + Branch */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                          htmlFor="worker-type"
                        >
                          {t('Specialty')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">
                            styler
                          </span>
                          <select
                            {...register('worker_type')}
                            id="worker-type"
                            className="input-field pl-12 appearance-none"
                          >
                            <option value="tailor">{t('Tailor')}</option>
                            <option value="master_cutter">{t('Master Cutter')}</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                            expand_more
                          </span>
                        </div>
                      </div>

                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                          htmlFor="worker-branch"
                        >
                          {t('Branch')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">
                            store
                          </span>
                          <select
                            {...register('branch_id', { valueAsNumber: true })}
                            id="worker-branch"
                            className="input-field pl-12 appearance-none"
                          >
                            {branches.map((b: any) => (
                              <option key={b.id} value={b.id}>
                                {b.name_en}
                              </option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Base Salary + Default Rate */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                          htmlFor="worker-salary"
                        >
                          {t('Base Salary')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">
                            payments
                          </span>
                          <input
                            {...register('base_salary', { valueAsNumber: true })}
                            id="worker-salary"
                            type="number"
                            min="0"
                            step="0.01"
                            className="input-field pl-12"
                            placeholder="0.00"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1"
                          htmlFor="worker-rate"
                        >
                          {t('Default Rate %')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">
                            percent
                          </span>
                          <input
                            {...register('default_rate', { valueAsNumber: true })}
                            id="worker-rate"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            className="input-field pl-12"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    <p className="text-on-surface-variant text-[11px] -mt-2 ml-1">
                      {t('Set salary to 0 for piece-rate workers. Default rate % is used when no specific rate is set.')}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting && (
                        <span className="material-symbols-outlined animate-spin text-base">
                          progress_activity
                        </span>
                      )}
                      {isSubmitting
                        ? t('Saving...')
                        : editingWorker
                          ? t('Update Worker')
                          : t('Create Worker')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Record Payment Modal ---- */}
      {paymentModalWorker && (
        <div className="modal-backdrop" onClick={closePaymentModal}>
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="modal-content w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-6 md:px-8 md:py-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                        payments
                      </span>
                    </div>
                    <div>
                      <h2 className="text-xl font-headline font-extrabold text-on-surface">
                        {t('Record Payment')}
                      </h2>
                      <p className="text-secondary text-xs mt-0.5 truncate">
                        {paymentModalWorker.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closePaymentModal}
                    className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {`${t('Amount')} (${t(currency)})`}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">
                        payments
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="input-field pl-12"
                        placeholder="0.00"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Note (optional)')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline mt-[-2px]">
                        note
                      </span>
                      <input
                        type="text"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        className="input-field pl-12"
                        placeholder={t('e.g. March salary, advance payment...')}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6">
                  <button
                    onClick={closePaymentModal}
                    className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                  >
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={paymentSubmitting || !paymentAmount || Number(paymentAmount) <= 0}
                    className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    {paymentSubmitting && (
                      <span className="material-symbols-outlined animate-spin text-base">
                        progress_activity
                      </span>
                    )}
                    {paymentSubmitting ? t('Saving...') : t('Record Payment')}
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
