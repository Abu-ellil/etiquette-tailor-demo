import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../contexts/I18nContext';

interface ProductionEntry {
  worker_id: number;
  piece_type: string;
  quantity: number;
  base_price?: number;
  wage_rate?: number;
  wage_amount?: number;
}

interface DailyProductionRecord {
  id: number;
  worker_name: string;
  production_date: string;
  piece_type: string;
  quantity: number;
  wage_rate: number;
  wage_amount: number;
  notes?: string;
}

interface WorkerRate {
  user_id: number;
  piece_type: string;
  wage_type: 'percentage' | 'fixed';
  rate: number;
}

export default function DailyProductionPage() {
  const { t, currency } = useTranslation();
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [pieceTypes, setPieceTypes] = useState<any[]>([]);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [existingRecords, setExistingRecords] = useState<DailyProductionRecord[]>([]);
  const [workerRates, setWorkerRates] = useState<Record<string, WorkerRate>>({});
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);

  // Load initial data
  useEffect(() => {
    window.electronAPI.auth.getSession().then((s: any) => setSession(s));
    loadWorkers();
    loadPieceTypes();
  }, []);

  // Load existing records when date changes
  useEffect(() => {
    if (selectedDate) {
      loadExistingRecords(selectedDate);
    }
  }, [selectedDate]);

  const loadWorkers = async () => {
    try {
      const data = await window.electronAPI.workers.getAll();
      setWorkers(data.filter((w: any) => w.active === 1));
    } catch (err) {
      console.error('Failed to load workers:', err);
    }
  };

  const loadPieceTypes = async () => {
    try {
      const data = await window.electronAPI.pieceTypes.getAll();
      setPieceTypes(data.filter((p: any) => p.active === 1));
    } catch (err) {
      console.error('Failed to load piece types:', err);
    }
  };

  const loadExistingRecords = async (date: string) => {
    try {
      setLoading(true);
      const data = await window.electronAPI.dailyProduction.getByDate(date);
      setExistingRecords(data || []);
    } catch (err) {
      console.error('Failed to load daily production:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkerRate = async (workerId: number, pieceType: string): Promise<WorkerRate | null> => {
    const key = `${workerId}-${pieceType}`;
    if (workerRates[key]) return workerRates[key];

    try {
      const rate = await window.electronAPI.workers.getActiveRate(workerId, pieceType);
      if (rate) {
        setWorkerRates(prev => ({ ...prev, [key]: rate }));
        return rate;
      }
      return null;
    } catch {
      return null;
    }
  };

  const calculateWage = async (workerId: number, pieceType: string, quantity: number): Promise<{ rate: number; amount: number; basePrice: number } | null> => {
    const rate = await loadWorkerRate(workerId, pieceType);
    if (!rate) return null;

    const pieceTypeData = pieceTypes.find(p => p.name_en === pieceType);
    const basePrice = pieceTypeData?.base_price || 0;

    const wageAmount = rate.wage_type === 'percentage'
      ? basePrice * (rate.rate / 100) * quantity
      : rate.rate * quantity;

    return { rate: rate.rate, amount: wageAmount, basePrice };
  };

  const addEntry = () => {
    setEntries([...entries, {
      worker_id: 0,
      piece_type: '',
      quantity: 1,
    }]);
  };

  const updateEntry = async (index: number, field: keyof ProductionEntry, value: any) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };

    // Auto-calculate wage when worker, piece type, or quantity changes
    if (field === 'worker_id' || field === 'piece_type' || field === 'quantity') {
      const entry = updated[index];
      if (entry.worker_id && entry.piece_type && entry.quantity > 0) {
        const wage = await calculateWage(entry.worker_id, entry.piece_type, entry.quantity);
        if (wage) {
          updated[index].wage_rate = wage.rate;
          updated[index].wage_amount = wage.amount;
          updated[index].base_price = wage.basePrice;
        } else {
          updated[index].wage_rate = undefined;
          updated[index].wage_amount = undefined;
          updated[index].base_price = undefined;
        }
      }
    }

    setEntries(updated);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (entries.length === 0) {
      alert(t('Please add at least one production entry.'));
      return;
    }

    // Validate all entries
    const invalid = entries.find(e => !e.worker_id || !e.piece_type || e.quantity <= 0 || !e.wage_amount);
    if (invalid) {
      alert(t('Please fill in all fields with valid values. Some entries are missing wage rates.'));
      return;
    }

    try {
      setLoading(true);
      for (const entry of entries) {
        await window.electronAPI.dailyProduction.create({
          worker_id: entry.worker_id,
          production_date: selectedDate,
          piece_type: entry.piece_type,
          quantity: entry.quantity,
          wage_rate: entry.wage_rate || 0,
          wage_amount: entry.wage_amount || 0,
        });
      }

      // Clear entries and reload
      setEntries([]);
      await loadExistingRecords(selectedDate);
      alert(t('Daily production recorded successfully!'));
    } catch (err) {
      console.error('Failed to save daily production:', err);
      alert(t('Failed to save daily production.'));
    } finally {
      setLoading(false);
    }
  };

  const deleteRecord = async (id: number) => {
    if (!confirm(t('Delete this record?'))) return;
    try {
      await window.electronAPI.dailyProduction.delete(id);
      await loadExistingRecords(selectedDate);
    } catch (err) {
      console.error('Failed to delete record:', err);
      alert(t('Failed to delete record.'));
    }
  };

  const getWorkerName = (workerId: number) => {
    const worker = workers.find(w => w.id === workerId);
    return worker?.name || t('Unknown');
  };

  const getTotalWage = () => {
    return existingRecords.reduce((sum, r) => sum + r.wage_amount, 0) +
           entries.reduce((sum, e) => sum + (e.wage_amount || 0), 0);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
          {t('Daily Production')}
        </h1>
        <p className="text-secondary mt-1">{t('Record worker daily output and calculate wages')}</p>
      </div>

      {/* Date selector */}
      <div className="bg-surface-container-lowest rounded-xl p-6">
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-on-surface">{t('Date')}</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="input-field"
            max={today}
          />
        </div>
      </div>

      {/* New Entry Section */}
      {(!editMode || entries.length > 0) && (
        <div className="bg-surface-container-lowest rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-headline font-bold">{t('New Entries')}</h2>
            <button
              onClick={addEntry}
              className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
            >
              <span className="material-symbols-outlined">add</span>
              {t('Add Entry')}
            </button>
          </div>

          {entries.length === 0 ? (
            <p className="text-secondary text-sm py-4">{t('No entries yet. Click "Add Entry" to start.')}</p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <div key={index} className="border border-outline-variant/20 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-5 gap-4">
                    {/* Worker */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                        {t('Worker')}
                      </label>
                      <select
                        value={entry.worker_id}
                        onChange={(e) => updateEntry(index, 'worker_id', Number(e.target.value))}
                        className="input-field w-full appearance-none"
                      >
                        <option value="0">{t('Select worker')}</option>
                        {workers.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Piece Type */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                        {t('Piece Type')}
                      </label>
                      <select
                        value={entry.piece_type}
                        onChange={(e) => updateEntry(index, 'piece_type', e.target.value)}
                        className="input-field w-full appearance-none"
                      >
                        <option value="">{t('Select type')}</option>
                        {pieceTypes.map(p => (
                          <option key={p.name_en} value={p.name_en}>{p.name_en}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                        {t('Quantity')}
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={entry.quantity}
                        onChange={(e) => updateEntry(index, 'quantity', Number(e.target.value))}
                        className="input-field w-full"
                      />
                    </div>

                    {/* Base Price */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                        {t('Base Price')}
                      </label>
                      <div className="input-field w-full bg-surface-container-high flex items-center justify-center">
                        <span className="font-bold text-secondary">
                          {entry.base_price ? `${entry.base_price.toFixed(2)} ${t(currency)}` : '--'}
                        </span>
                      </div>
                    </div>

                    {/* Wage */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">
                        {t('Wage')}
                      </label>
                      <div className="input-field w-full bg-surface-container-high flex items-center justify-between">
                        <span className="font-bold text-primary">
                          {entry.wage_amount ? `${entry.wage_amount.toFixed(2)} ${t(currency)}` : '--'}
                        </span>
                        {entry.wage_amount && (
                          <span className="text-xs text-secondary">
                            {entry.wage_rate}{t('%')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remove button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => removeEntry(index)}
                      className="text-error text-sm hover:underline flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      {t('Remove')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Submit button */}
          {entries.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-4 bg-primary/5 rounded-lg">
              <div>
                <span className="text-sm text-secondary">{t('Total Wage')}</span>
                <span className="ml-4 text-lg font-bold text-primary">
                  {entries.reduce((sum, e) => sum + (e.wage_amount || 0), 0).toFixed(2)} {t(currency)}
                </span>
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary px-6 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {loading && <span className="material-symbols-outlined animate-spin">progress_activity</span>}
                {t('Save All Entries')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Existing Records */}
      <div className="bg-surface-container-lowest rounded-xl p-6">
        <h2 className="text-lg font-headline font-bold mb-4">
          {t('Records for {date}').replace('{date}', selectedDate)}
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-secondary">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            {t('Loading...')}
          </div>
        ) : existingRecords.length === 0 ? (
          <p className="text-secondary text-sm py-4">{t('No records found for this date.')}</p>
        ) : (
          <div className="space-y-2">
            {existingRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between bg-surface rounded-lg p-3">
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-on-surface">{record.worker_name}</span>
                  <span className="text-secondary">·</span>
                  <span className="text-on-surface">{record.piece_type}</span>
                  <span className="text-secondary">×{record.quantity}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-primary">
                    {record.wage_amount.toFixed(2)} {t(currency)}
                  </span>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="text-error hover:bg-error/10 p-1 rounded"
                    title={t('Delete')}
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total summary */}
        {existingRecords.length > 0 && (
          <div className="mt-4 pt-4 border-t border-outline-variant/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-on-surface">{t('Total for this date')}</span>
              <span className="text-xl font-bold text-primary">
                {existingRecords.reduce((sum, r) => sum + r.wage_amount, 0).toFixed(2)} {t(currency)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
