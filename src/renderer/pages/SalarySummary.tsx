import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../contexts/I18nContext';

interface Worker {
  id: number;
  name: string;
  worker_type?: string | null;
  base_salary: number;
  branch_id: number;
}

interface WorkerData {
  worker: Worker;
  earnings: any;
  account: any;
  payAmount: string;
  payNote: string;
  selected: boolean;
}

export default function SalarySummaryPage() {
  const { t, currency } = useTranslation();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerData, setWorkerData] = useState<WorkerData[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [loading, setLoading] = useState(true);
  const [batchMode, setBatchMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const workersData: Worker[] = await window.electronAPI.workers.getAll();
      setWorkers(workersData || []);

      const data: WorkerData[] = await Promise.all(
        (workersData || []).map(async (w) => {
          const [earnings, account] = await Promise.all([
            window.electronAPI.workers.getMonthlyEarnings(w.id, selectedMonth),
            window.electronAPI.workers.getAccount(w.id),
          ]);
          return { worker: w, earnings, account, payAmount: '', payNote: '', selected: false };
        })
      );
      setWorkerData(data);
    } catch (err) {
      console.error('Failed to load salary data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBatchPayment = async () => {
    const payments = workerData
      .filter((d) => d.selected && Number(d.payAmount) > 0)
      .map((d) => ({ userId: d.worker.id, amount: Number(d.payAmount), note: d.payNote || null }));

    if (payments.length === 0) return;
    try {
      setSubmitting(true);
      await window.electronAPI.workers.batchPayments(payments);
      setBatchMode(false);
      await loadData();
    } catch (err) {
      console.error('Failed to submit batch payments:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateWorkerData = (index: number, updates: Partial<WorkerData>) => {
    setWorkerData((prev) => prev.map((d, i) => (i === index ? { ...d, ...updates } : d)));
  };

  const toggleSelectAll = () => {
    const allSelected = workerData.every((d) => d.selected);
    setWorkerData((prev) => prev.map((d) => ({ ...d, selected: !allSelected })));
  };

  // Totals
  const totalEarnings = workerData.reduce((s, d) => s + (d.earnings?.total_earnings || 0), 0);
  const totalPaid = workerData.reduce((s, d) => s + (d.account?.total_paid || 0), 0);
  const totalBalance = workerData.reduce((s, d) => s + (d.account?.balance || 0), 0);

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
            {t('Salary Summary')}
          </h1>
          <p className="text-secondary mt-1 text-lg">
            {t('Overview of all workers salary and payments')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input-field w-44"
          />
          <button
            onClick={() => setBatchMode(!batchMode)}
            className={`px-6 py-3 text-sm font-bold rounded-lg transition-colors flex items-center gap-2 ${
              batchMode ? 'bg-primary-container text-white' : 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-sm">payments</span>
            {t('Batch Payment')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-36">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Workers')}</span>
          <span className="text-4xl font-extrabold text-on-surface">{workers.length}</span>
        </div>
        <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between h-36">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Total Earnings')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-primary">{totalEarnings.toFixed(0)}</span>
            <span className="text-secondary">{t(currency)}</span>
          </div>
        </div>
        <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.03)] flex flex-col justify-between h-36">
          <span className="text-secondary font-headline text-xs font-bold uppercase tracking-widest">{t('Total Paid')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold text-on-surface">{totalPaid.toFixed(0)}</span>
            <span className="text-secondary">{t(currency)}</span>
          </div>
        </div>
        <div className="bg-primary-container p-8 rounded-xl text-white flex flex-col justify-between h-36">
          <span className="text-white/80 font-headline text-xs font-bold uppercase tracking-widest">{t('Outstanding Balance')}</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold">{totalBalance.toFixed(0)}</span>
            <span className="text-white/70">{t(currency)}</span>
          </div>
        </div>
      </div>

      {/* Batch mode instructions */}
      {batchMode && (
        <div className="bg-primary-container/10 border border-primary-container/20 rounded-xl px-6 py-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">info</span>
          <p className="text-sm text-on-surface">{t('Enter payment amounts for workers below')}</p>
        </div>
      )}

      {/* Workers Table */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
        {workerData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3 text-outline">account_balance_wallet</span>
            <p className="font-headline font-bold text-on-surface text-lg">{t('No workers found.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {batchMode && (
                    <th className="w-10">
                      <input
                        type="checkbox"
                        checked={workerData.every((d) => d.selected)}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 accent-primary"
                      />
                    </th>
                  )}
                  <th>{t('Worker Name')}</th>
                  <th>{t('Tasks Done')}</th>
                  <th>{t('Piece Earnings')}</th>
                  <th>{t('Base Salary')}</th>
                  <th>{t('Total')}</th>
                  <th>{t('Total Paid')}</th>
                  <th>{t('Balance')}</th>
                  {batchMode && <th>{t('Amount to Pay')}</th>}
                </tr>
              </thead>
              <tbody>
                {workerData.map((d, i) => (
                  <tr key={d.worker.id}>
                    {batchMode && (
                      <td>
                        <input
                          type="checkbox"
                          checked={d.selected}
                          onChange={() => updateWorkerData(i, { selected: !d.selected })}
                          className="w-4 h-4 accent-primary"
                        />
                      </td>
                    )}
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-white text-xs font-bold">
                          {d.worker.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface">{d.worker.name}</p>
                          <p className="text-xs text-secondary">
                            {d.worker.worker_type === 'master_cutter' ? t('Master Cutter') : t('Tailor')}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="font-semibold">{d.earnings?.task_count || 0}</td>
                    <td>{(d.earnings?.piece_earnings || 0).toFixed(0)} {t(currency)}</td>
                    <td>{(d.earnings?.fixed_salary || 0).toFixed(0)} {t(currency)}</td>
                    <td className="font-bold text-primary">{(d.earnings?.total_earnings || 0).toFixed(0)} {t(currency)}</td>
                    <td className="text-on-surface">{(d.account?.total_paid || 0).toFixed(0)} {t(currency)}</td>
                    <td>
                      <span className={`font-bold ${(d.account?.balance || 0) > 0 ? 'text-error' : 'text-on-surface'}`}>
                        {(d.account?.balance || 0).toFixed(0)} {t(currency)}
                      </span>
                    </td>
                    {batchMode && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={d.payAmount}
                          onChange={(e) => updateWorkerData(i, { payAmount: e.target.value })}
                          className="input-field w-28 text-sm py-1.5"
                          placeholder={t('Enter amount')}
                        />
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-container font-bold">
                  {batchMode && <td></td>}
                  <td>{t('Total')}</td>
                  <td>{workerData.reduce((s, d) => s + (d.earnings?.task_count || 0), 0)}</td>
                  <td>{workerData.reduce((s, d) => s + (d.earnings?.piece_earnings || 0), 0).toFixed(0)} {t(currency)}</td>
                  <td>{workerData.reduce((s, d) => s + (d.earnings?.fixed_salary || 0), 0).toFixed(0)} {t(currency)}</td>
                  <td className="text-primary">{totalEarnings.toFixed(0)} {t(currency)}</td>
                  <td>{totalPaid.toFixed(0)} {t(currency)}</td>
                  <td className={totalBalance > 0 ? 'text-error' : ''}>{totalBalance.toFixed(0)} {t(currency)}</td>
                  {batchMode && (
                    <td className="text-primary">
                      {workerData.filter((d) => d.selected && Number(d.payAmount) > 0).reduce((s, d) => s + Number(d.payAmount), 0).toFixed(0)} {t(currency)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Batch Submit */}
      {batchMode && (
        <div className="flex justify-end">
          <button
            onClick={handleBatchPayment}
            disabled={submitting || workerData.filter((d) => d.selected && Number(d.payAmount) > 0).length === 0}
            className="btn-primary px-8 py-4 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {submitting && <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>}
            {submitting ? t('Saving...') : t('Submit Batch Payments')}
          </button>
        </div>
      )}
    </div>
  );
}
