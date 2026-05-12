import React, { useState, useEffect } from 'react';

interface Worker {
  id: number;
  name: string;
  worker_type: string | null;
  default_rate: number;
  active: number;
}

interface WorkerRate {
  wage_type: 'percentage' | 'fixed';
  rate: number;
}

interface OrderItem {
  piece_type: string;
  quantity: number;
  unit_price: number;
  fabric_source: string;
  details: string;
}

interface ItemAssignment {
  cutter_id?: number;
  cutter_wage_type?: 'percentage' | 'fixed';
  cutter_wage_rate?: number;
  tailors: { worker_id: number; quantity: number; wage_type: 'percentage' | 'fixed'; wage_rate: number }[];
}

interface WorkerAssignerProps {
  items: OrderItem[];
  t: (key: string) => string;
  onConfirm: (assignments: ItemAssignment[]) => void;
  onBack: () => void;
}

export default function WorkerAssigner({ items, t, onConfirm, onBack }: WorkerAssignerProps) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [assignments, setAssignments] = useState<ItemAssignment[]>(
    items.map(() => ({ tailors: [] }))
  );
  const [rateCache, setRateCache] = useState<Record<string, WorkerRate>>({});

  useEffect(() => {
    window.electronAPI.workers.getAll().then((w: Worker[]) => setWorkers(w.filter((x: Worker) => x.active === 1)));
  }, []);

  const cutters = workers.filter(w => w.worker_type === 'master_cutter');
  const tailors = workers.filter(w => w.worker_type === 'tailor');

  const getRate = async (workerId: number, pieceType: string): Promise<WorkerRate | null> => {
    const key = `${workerId}-${pieceType}`;
    if (rateCache[key]) return rateCache[key];
    try {
      const rate = await window.electronAPI.workers.getActiveRate(workerId, pieceType);
      if (rate) { setRateCache(prev => ({ ...prev, [key]: rate })); }
      return rate;
    } catch { return null; }
  };

  const handleAssignCutter = async (itemIdx: number, cutterId: number) => {
    const rate = await getRate(cutterId, items[itemIdx].piece_type);
    const worker = workers.find(w => w.id === cutterId);
    const fallbackType = (rate?.wage_type || (worker?.default_rate ? 'percentage' : 'fixed')) as 'percentage' | 'fixed';
    const fallbackRate = rate?.rate || worker?.default_rate || 0;
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a, cutter_id: cutterId, cutter_wage_type: fallbackType, cutter_wage_rate: fallbackRate,
    } : a));
  };

  const handleAddTailor = async (itemIdx: number, tailorId: number) => {
    const item = items[itemIdx];
    const rate = await getRate(tailorId, item.piece_type);
    const worker = workers.find(w => w.id === tailorId);
    const fallbackType = (rate?.wage_type || (worker?.default_rate ? 'percentage' : 'fixed')) as 'percentage' | 'fixed';
    const fallbackRate = rate?.rate || worker?.default_rate || 0;
    const currentAssignedQty = assignments[itemIdx].tailors.reduce((s, t) => s + t.quantity, 0);
    const remainingQty = item.quantity - currentAssignedQty;
    if (remainingQty <= 0) return;
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a, tailors: [...a.tailors, { worker_id: tailorId, quantity: Math.min(remainingQty, 1), wage_type: fallbackType, wage_rate: fallbackRate }],
    } : a));
  };

  const updateTailorQty = (itemIdx: number, tailorIdx: number, qty: number) => {
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a, tailors: a.tailors.map((tl, ti) => ti === tailorIdx ? { ...tl, quantity: Math.max(1, qty) } : tl),
    } : a));
  };

  const removeTailor = (itemIdx: number, tailorIdx: number) => {
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a, tailors: a.tailors.filter((_, ti) => ti !== tailorIdx),
    } : a));
  };

  const calcCutterWage = (itemIdx: number) => {
    const a = assignments[itemIdx]; const item = items[itemIdx];
    if (!a.cutter_wage_rate) return 0;
    return a.cutter_wage_type === 'percentage' ? (item.unit_price * item.quantity * a.cutter_wage_rate / 100) : a.cutter_wage_rate;
  };

  const calcTailorWage = (itemIdx: number, tailorIdx: number) => {
    const a = assignments[itemIdx]; const item = items[itemIdx]; const tl = a.tailors[tailorIdx];
    if (!tl) return 0;
    return tl.wage_type === 'percentage' ? (item.unit_price * tl.quantity * tl.wage_rate / 100) : tl.wage_rate;
  };

  const allCuttersAssigned = assignments.every(a => a.cutter_id);

  const handleNext = () => {
    if (!allCuttersAssigned) { alert(t('Please assign a cutter for each item.')); return; }
    onConfirm(assignments);
  };

  return (
    <div className="space-y-6">
      {items.map((item, itemIdx) => {
        const assignment = assignments[itemIdx];
        const assignedTailorQty = assignment.tailors.reduce((s, tl) => s + tl.quantity, 0);
        const remainingQty = item.quantity - assignedTailorQty;
        return (
          <div key={itemIdx} className="bg-surface-container-low rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-bold text-primary uppercase">#{itemIdx + 1}</span>
                <span className="ml-2 font-semibold text-on-surface">{item.piece_type}</span>
                <span className="ml-2 text-secondary text-sm">× {item.quantity}</span>
              </div>
              <span className="font-bold text-on-surface">{(item.unit_price * item.quantity).toFixed(2)} {t('QAR')}</span>
            </div>
            <div className="border-t border-outline-variant/30 pt-4">
              <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 block">
                <span className="material-symbols-outlined text-sm align-middle mr-1">content_cut</span>{t('Assign Cutter')}
              </label>
              <select value={assignment.cutter_id || ''} onChange={e => e.target.value && handleAssignCutter(itemIdx, parseInt(e.target.value))} className="input-field">
                <option value="">{t('Select cutter...')}</option>
                {cutters.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
              {assignment.cutter_wage_rate !== undefined && assignment.cutter_id && (
                <div className="mt-1 text-xs text-secondary">
                  {t('Wage')}: {calcCutterWage(itemIdx).toFixed(2)} {t('QAR')}
                  <span className="ml-1">({assignment.cutter_wage_type === 'percentage' ? `${assignment.cutter_wage_rate}%` : `${assignment.cutter_wage_rate} fixed`})</span>
                </div>
              )}
            </div>
            <div className="border-t border-outline-variant/30 pt-4">
              <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 block">
                <span className="material-symbols-outlined text-sm align-middle mr-1">styler</span>{t('Assign Tailors')}
                {item.quantity > 1 && (<span className="ml-2 text-xs font-normal">({assignedTailorQty}/{item.quantity} {t('assigned')})</span>)}
              </label>
              {assignment.tailors.map((tl, ti) => {
                const worker = tailors.find(w => w.id === tl.worker_id);
                return (
                  <div key={ti} className="flex items-center gap-3 mb-2 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <span className="text-sm font-medium flex-1">{worker?.name || tl.worker_id}</span>
                    <input type="number" min={1} max={item.quantity} value={tl.quantity} onChange={e => updateTailorQty(itemIdx, ti, parseInt(e.target.value) || 1)} className="input-field w-16 text-center h-9" />
                    <span className="text-xs text-secondary">{calcTailorWage(itemIdx, ti).toFixed(2)} {t('QAR')}</span>
                    <button onClick={() => removeTailor(itemIdx, ti)} className="text-outline hover:text-error"><span className="material-symbols-outlined text-sm">close</span></button>
                  </div>
                );
              })}
              {remainingQty > 0 && (
                <select value="" onChange={e => e.target.value && handleAddTailor(itemIdx, parseInt(e.target.value))} className="input-field text-sm">
                  <option value="">{t('+ Add tailor...')}</option>
                  {tailors.filter(w => !assignment.tailors.some(at => at.worker_id === w.id)).map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                </select>
              )}
              {remainingQty <= 0 && assignment.tailors.length > 0 && (
                <div className="text-xs text-tertiary font-semibold">
                  <span className="material-symbols-outlined text-xs align-middle mr-1">check_circle</span>{t('All pieces assigned to tailors')}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors">{t('Back')}</button>
        <button onClick={handleNext} className="btn-primary flex-1">
          {t('Continue to Summary')}<span className="material-symbols-outlined text-sm ml-2 align-middle">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
