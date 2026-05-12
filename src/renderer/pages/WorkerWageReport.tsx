import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { useTranslation } from '../contexts/I18nContext';

interface Worker {
  id: number;
  name: string;
  worker_type?: string | null;
  base_salary: number;
  branch_id: number;
}

export default function WorkerWageReportPage() {
  const { t, currency } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<number | null>(null);
  const [periodMode, setPeriodMode] = useState<'this_month' | 'last_month' | 'custom' | 'all'>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  const [account, setAccount] = useState<any>(null);
  const [earnings, setEarnings] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [taskDetails, setTaskDetails] = useState<any[]>([]);

  // Payment modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    switch (periodMode) {
      case 'this_month': {
        const s = startOfMonth(now);
        const e = endOfMonth(now);
        return { start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd') + 'T23:59:59' };
      }
      case 'last_month': {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const s = startOfMonth(prev);
        const e = endOfMonth(prev);
        return { start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd') + 'T23:59:59' };
      }
      case 'custom':
        return { start: customStart, end: customEnd + 'T23:59:59' };
      case 'all':
        return { start: '2000-01-01', end: '2099-12-31T23:59:59' };
    }
  }, [periodMode, customStart, customEnd]);

  useEffect(() => {
    window.electronAPI.workers.getAll().then((data: Worker[]) => {
      setWorkers(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadWorkerData = useCallback(async () => {
    if (!selectedWorkerId) return;
    setDataLoading(true);
    try {
      const range = getDateRange();
      const [acc, earn, pmts, details] = await Promise.all([
        window.electronAPI.workers.getAccount(selectedWorkerId),
        window.electronAPI.workers.getWorkerEarnings(selectedWorkerId, range.start, range.end),
        window.electronAPI.workers.getPayments(selectedWorkerId),
        window.electronAPI.workers.getWorkerOrderDetails(selectedWorkerId, range.start, range.end),
      ]);
      setAccount(acc);
      setEarnings(earn);
      setPayments(pmts || []);
      setTaskDetails(details || []);
    } catch (err) {
      console.error('Failed to load worker data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [selectedWorkerId, getDateRange]);

  useEffect(() => {
    loadWorkerData();
  }, [loadWorkerData]);

  const handleRecordPayment = async () => {
    if (!selectedWorkerId || !paymentAmount || Number(paymentAmount) <= 0) return;
    try {
      setPaymentSubmitting(true);
      await window.electronAPI.workers.addPayment(selectedWorkerId, Number(paymentAmount), paymentNote || null);
      setPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNote('');
      await loadWorkerData();
    } catch (err) {
      console.error('Failed to record payment:', err);
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '--';
    try { return format(parseISO(dateStr), 'MMM dd, yyyy'); } catch { return dateStr; }
  };

  const totalEarnings = earnings?.total_earnings || 0;
  const totalPaid = account?.total_paid || 0;
  const balance = account?.balance || 0;

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
          {t('Worker Wage Report')}
        </h1>
        <p className="text-secondary mt-1 text-lg">
          {t('View detailed wage report per worker')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
          <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
            {t('Worker')}
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-4 text-outline">person</span>
            <select
              value={selectedWorkerId || ''}
              onChange={(e) => setSelectedWorkerId(Number(e.target.value) || null)}
              className="input-field pl-12 appearance-none"
            >
              <option value="">{t('Select Worker...')}</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">expand_more</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
            {t('Period')}
          </label>
          <div className="flex gap-1 bg-surface-container rounded-lg p-1">
            {(['this_month', 'last_month', 'custom', 'all'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPeriodMode(mode)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-md transition-colors ${
                  periodMode === mode
                    ? 'bg-primary-container text-white shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {t(mode === 'this_month' ? 'This Month' : mode === 'last_month' ? 'Last Month' : mode === 'custom' ? 'Custom Range' : 'All Time')}
              </button>
            ))}
          </div>
        </div>

        {periodMode === 'custom' && (
          <div className="flex items-end gap-2">
            <div>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="input-field"
              />
            </div>
            <span className="text-secondary pb-3">{t('to')}</span>
            <div>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="input-field"
              />
            </div>
          </div>
        )}
      </div>

      {!selectedWorkerId ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-5xl mb-3 text-outline">receipt_long</span>
          <p className="font-headline font-bold text-on-surface text-lg">{t('Select Worker...')}</p>
          <p className="text-sm mt-1">{t('View detailed wage report per worker')}</p>
        </div>
      ) : dataLoading ? (
        <div className="flex items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          {t('Loading...')}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-36">
              <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">
                {t('Total Earnings')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-primary">{totalEarnings.toFixed(0)}</span>
                <span className="text-secondary font-medium">{t(currency)}</span>
              </div>
            </div>

            <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between h-36">
              <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">
                {t('Total Paid')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-on-surface">{totalPaid.toFixed(0)}</span>
                <span className="text-secondary font-medium">{t(currency)}</span>
              </div>
            </div>

            <div className={`p-8 rounded-xl flex flex-col justify-between h-36 ${balance > 0 ? 'bg-primary-container text-white' : 'bg-surface-container-lowest'}`}>
              <span className={`font-headline text-xs font-bold uppercase tracking-widest ${balance > 0 ? 'text-white/80' : 'text-secondary'}`}>
                {t('Remaining Balance')}
              </span>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-extrabold ${balance > 0 ? 'text-white' : 'text-on-surface'}`}>{balance.toFixed(0)}</span>
                <span className={`font-medium ${balance > 0 ? 'text-white/70' : 'text-secondary'}`}>{t(currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment History */}
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container-high flex justify-between items-center">
              <h2 className="text-lg font-headline font-bold text-on-surface">{t('Payment History')}</h2>
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="btn-primary flex items-center gap-2 py-2 px-4 text-xs"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                {t('Record Payment')}
              </button>
            </div>
            {payments.length === 0 ? (
              <p className="text-secondary text-sm p-6">{t('No payment records found.')}</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Date')}</th>
                    <th>{t('Amount')}</th>
                    <th>{t('Note')}</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p: any) => (
                    <tr key={p.id}>
                      <td className="text-secondary text-sm">{formatDate(p.created_at)}</td>
                      <td className="font-bold text-primary">{Number(p.amount).toFixed(0)} {t(currency)}</td>
                      <td className="text-secondary text-sm">{p.note || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Task Breakdown */}
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-container-high">
              <h2 className="text-lg font-headline font-bold text-on-surface">{t('Task Breakdown')}</h2>
              <p className="text-secondary text-xs mt-0.5">
                {earnings?.task_count || 0} {t('completed tasks')}
              </p>
            </div>
            {taskDetails.length === 0 ? (
              <p className="text-secondary text-sm p-6">{t('No completed tasks in this period.')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t('Order')}</th>
                      <th>{t('Piece Type')}</th>
                      <th>{t('Task Type')}</th>
                      <th>{t('Qty')}</th>
                      <th>{t('Wage Type')}</th>
                      <th>{t('Wage Rate')}</th>
                      <th>{t('Wage Amount')}</th>
                      <th>{t('Completed Date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskDetails.map((d: any) => (
                      <tr key={d.task_id}>
                        <td className="font-semibold">{d.order_number}</td>
                        <td className="text-secondary">{d.piece_type}</td>
                        <td>
                          <span className="chip chip-progress capitalize">{t(d.task_type)}</span>
                        </td>
                        <td className="text-center text-sm font-semibold">{d.task_quantity || 1}</td>
                        <td className="text-sm">{d.wage_type === 'percentage' ? t('Percentage') : t('Fixed')}</td>
                        <td className="text-sm">{d.wage_type === 'percentage' ? `${d.wage_rate}%` : `${Number(d.wage_rate).toFixed(0)} ${t(currency)}`}</td>
                        <td className="font-bold text-primary">
                          <span>{Number(d.wage_amount).toFixed(0)} {t(currency)}</span>
                          {d.wage_type === 'percentage' && d.price > 0 && (
                            <span className="block text-xs text-secondary font-normal mt-0.5">
                              {d.price} × {d.wage_rate}% × {d.task_quantity || 1} = {(d.price * (d.wage_rate / 100) * (d.task_quantity || 1)).toFixed(0)}
                            </span>
                          )}
                        </td>
                        <td className="text-secondary text-sm">{formatDate(d.completed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="modal-backdrop" onClick={() => setPaymentModalOpen(false)}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-6 md:px-8 md:py-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-tertiary-fixed flex items-center justify-center text-on-tertiary-fixed">
                      <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>payments</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-headline font-extrabold text-on-surface">{t('Record Payment')}</h2>
                      <p className="text-secondary text-xs mt-0.5">{workers.find(w => w.id === selectedWorkerId)?.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setPaymentModalOpen(false)} className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">{`${t('Amount')} (${t(currency)})`}</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">payments</span>
                      <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} className="input-field pl-12" placeholder="0.00" autoFocus />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">{t('Note (optional)')}</label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline mt-[-2px]">note</span>
                      <input type="text" value={paymentNote} onChange={(e) => setPaymentNote(e.target.value)} className="input-field pl-12" placeholder={t('e.g. March salary, advance payment...')} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 pt-6">
                  <button onClick={() => setPaymentModalOpen(false)} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors">{t('Cancel')}</button>
                  <button onClick={handleRecordPayment} disabled={paymentSubmitting || !paymentAmount || Number(paymentAmount) <= 0} className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50">
                    {paymentSubmitting && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
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
