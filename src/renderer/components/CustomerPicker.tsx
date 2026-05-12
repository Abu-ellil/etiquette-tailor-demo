import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface Customer {
  id: number;
  name: string;
  phone: string;
  notes: string;
}

interface MeasurementData {
  chest?: number;
  waist?: number;
  hips?: number;
  length?: number;
  sleeve?: number;
  shoulder?: number;
  notes?: string;
}

interface CustomerPickerProps {
  branchId: number;
  t: (key: string) => string;
  onSelect: (customerId: number, measurements?: MeasurementData) => void;
  selectedCustomerId?: number | null;
}

const MEASUREMENT_FIELDS = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'length', label: 'Length' },
  { key: 'sleeve', label: 'Sleeve' },
  { key: 'shoulder', label: 'Shoulder' },
];

export default function CustomerPicker({ branchId, t, onSelect, selectedCustomerId }: CustomerPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementData>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: '', phone: '', notes: '' } });

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    const res = await window.electronAPI.customers.search(q);
    setResults(res);
  }, []);

  const onSearchChange = (val: string) => {
    setQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(val), 250);
  };

  const pickCustomer = (c: Customer) => {
    setSelected(c);
    setQuery(c.name);
    setResults([]);
    setShowCreate(false);
    setShowMeasurements(true);
  };

  const onCreateCustomer = async (data: { name: string; phone: string; notes: string }) => {
    const newCustomer = await window.electronAPI.customers.create({
      name: data.name,
      phone: data.phone,
      notes: data.notes,
      branch_id: branchId,
    });
    setSelected(newCustomer);
    setShowCreate(false);
    setShowMeasurements(true);
    reset();
  };

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value ? parseFloat(value) : undefined }) as MeasurementData);
  };

  const handleConfirm = () => {
    if (!selected) return;
    const hasValues = Object.values(measurements).some(v => v !== undefined);
    onSelect(selected.id, hasValues ? measurements : undefined);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 block">
          {t('Search or Create Customer')}
        </label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            type="text"
            value={query}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={t('Type customer name or phone...')}
            className="input-field pl-12"
          />
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-lg max-h-48 overflow-y-auto">
          {results.map(c => (
            <button
              key={c.id}
              onClick={() => pickCustomer(c)}
              className="w-full text-left px-4 py-3 hover:bg-surface-container-high transition-colors flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary-fixed text-on-primary-fixed text-xs font-bold flex items-center justify-center shrink-0">
                {c.name.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-sm">{c.name}</div>
                {c.phone && <div className="text-xs text-secondary">{c.phone}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {!selected && !showCreate && results.length === 0 && query.length >= 2 && (
        <div className="text-center py-4">
          <p className="text-secondary text-sm mb-2">{t('No customer found.')}</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm px-4 py-2">
            <span className="material-symbols-outlined text-sm mr-1 align-middle">person_add</span>
            {t('Create New Customer')}
          </button>
        </div>
      )}

      {!selected && !showCreate && query.length < 2 && (
        <div className="text-center py-4">
          <p className="text-secondary text-sm">{t('Start typing to search existing customers, or create a new one.')}</p>
        </div>
      )}

      {showCreate && !selected && (
        <form onSubmit={handleSubmit(onCreateCustomer)} className="bg-surface-container-low rounded-xl p-6 space-y-4">
          <h3 className="font-headline font-semibold text-on-surface">{t('New Customer')}</h3>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Name')}</label>
            <input {...register('name')} className="input-field" placeholder={t('Full name')} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Phone')}</label>
            <input {...register('phone')} className="input-field" placeholder={t('Phone number')} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Notes')}</label>
            <input {...register('notes')} className="input-field" placeholder={t('Optional notes')} />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary text-sm">{t('Create & Continue')}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-secondary hover:text-on-surface">{t('Cancel')}</button>
          </div>
        </form>
      )}

      {selected && (
        <div className="bg-primary-fixed/20 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center">
            {selected.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-on-surface truncate">{selected.name}</div>
            {selected.phone && <div className="text-xs text-secondary">{selected.phone}</div>}
          </div>
          <button onClick={() => { setSelected(null); setShowMeasurements(false); setQuery(''); }} className="text-secondary hover:text-on-surface">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <button
            onClick={() => setShowMeasurements(!showMeasurements)}
            className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-sm">{showMeasurements ? 'expand_less' : 'expand_more'}</span>
            {t('Take Measurements')}
            <span className="text-xs text-secondary font-normal">({t('Optional')})</span>
          </button>
          {showMeasurements && (
            <div className="grid grid-cols-3 gap-4">
              {MEASUREMENT_FIELDS.map(f => (
                <div key={f.key}>
                  <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t(f.label)}</label>
                  <input
                    type="number"
                    step="0.5"
                    value={measurements[f.key as keyof MeasurementData] ?? ''}
                    onChange={e => handleMeasurementChange(f.key, e.target.value)}
                    className="input-field"
                    placeholder="—"
                  />
                </div>
              ))}
              <div className="col-span-3">
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Notes')}</label>
                <input
                  type="text"
                  value={measurements.notes ?? ''}
                  onChange={e => setMeasurements(prev => ({ ...prev, notes: e.target.value }))}
                  className="input-field"
                  placeholder={t('Measurement notes')}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {selected && (
        <button onClick={handleConfirm} className="btn-primary w-full">
          {t('Continue to Order Details')}
          <span className="material-symbols-outlined text-sm ml-2 align-middle">arrow_forward</span>
        </button>
      )}
    </div>
  );
}
