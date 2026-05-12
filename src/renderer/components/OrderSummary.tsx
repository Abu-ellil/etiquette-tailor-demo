import React, { useState } from 'react';

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

interface Customer { id: number; name: string; phone: string; }
interface Worker { id: number; name: string; }

interface MeasurementData {
  chest?: number; waist?: number; hips?: number; length?: number; sleeve?: number; shoulder?: number; notes?: string;
}

interface OrderSummaryProps {
  customer: Customer;
  workers: Worker[];
  items: OrderItem[];
  assignments: ItemAssignment[];
  measurements?: MeasurementData;
  deliveryDate: string;
  paymentMethod: 'cash' | 'card';
  t: (key: string) => string;
  onSubmit: (initialPayment: number) => void;
  onBack: () => void;
  submitting?: boolean;
}

export default function OrderSummary({
  customer, workers, items, assignments, measurements,
  deliveryDate, paymentMethod, t, onSubmit, onBack, submitting
}: OrderSummaryProps) {
  const totalPrice = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const [payment, setPayment] = useState(0);
  const getWorkerName = (id: number) => workers.find(w => w.id === id)?.name || `#${id}`;

  return (
    <div className="space-y-5">
      <div className="bg-surface-container-low rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.05em] text-secondary">{t('Customer')}</h3>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center">{customer.name.charAt(0)}</div>
          <div>
            <div className="font-semibold">{customer.name}</div>
            {customer.phone && <div className="text-sm text-secondary">{customer.phone}</div>}
          </div>
        </div>
        {measurements && Object.values(measurements).some(v => v) && (
          <div className="grid grid-cols-3 gap-2 text-sm">
            {measurements.chest && <span>{t('Chest')}: {measurements.chest}</span>}
            {measurements.waist && <span>{t('Waist')}: {measurements.waist}</span>}
            {measurements.hips && <span>{t('Hips')}: {measurements.hips}</span>}
            {measurements.length && <span>{t('Length')}: {measurements.length}</span>}
            {measurements.sleeve && <span>{t('Sleeve')}: {measurements.sleeve}</span>}
            {measurements.shoulder && <span>{t('Shoulder')}: {measurements.shoulder}</span>}
          </div>
        )}
      </div>

      <div className="bg-surface-container-low rounded-xl p-5 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-[0.05em] text-secondary">{t('Items & Workers')}</h3>
        {items.map((item, idx) => {
          const a = assignments[idx];
          return (
            <div key={idx} className="border-t border-outline-variant/20 pt-3 first:border-0 first:pt-0">
              <div className="flex justify-between">
                <span className="font-semibold">{item.piece_type} × {item.quantity}</span>
                <span className="font-bold">{(item.unit_price * item.quantity).toFixed(2)} {t('QAR')}</span>
              </div>
              <div className="mt-1 text-sm text-secondary space-y-0.5">
                {a.cutter_id && (
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">content_cut</span>
                    <span>{t('Cutter')}: {getWorkerName(a.cutter_id)}</span>
                  </div>
                )}
                {a.tailors.map((tl, ti) => (
                  <div key={ti} className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">styler</span>
                    <span>{t('Tailor')}: {getWorkerName(tl.worker_id)} × {tl.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-surface-container-low rounded-xl p-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-secondary">{t('Delivery Date')}</div>
          <div className="font-semibold">{deliveryDate}</div>
        </div>
        <div>
          <div className="text-xs text-secondary">{t('Payment Method')}</div>
          <div className="font-semibold capitalize">{paymentMethod}</div>
        </div>
      </div>

      <div className="bg-primary-fixed/20 rounded-xl p-5">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold">{t('Total')}</span>
          <span className="text-xl font-extrabold text-primary">{totalPrice.toFixed(2)} {t('QAR')}</span>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Initial Payment')}</label>
          <input type="number" step="0.01" min={0} max={totalPrice} value={payment} onChange={e => setPayment(Math.max(0, parseFloat(e.target.value) || 0))} className="input-field" placeholder="0.00" />
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-secondary">{t('Balance')}</span>
            <span className={`font-bold ${(totalPrice - payment) > 0 ? 'text-error' : 'text-tertiary'}`}>
              {(totalPrice - payment).toFixed(2)} {t('QAR')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors">{t('Back')}</button>
        <button onClick={() => onSubmit(payment)} disabled={submitting} className="btn-primary flex-1">
          {submitting ? (
            <><span className="material-symbols-outlined text-sm mr-1 animate-spin align-middle">progress_activity</span>{t('Creating...')}</>
          ) : (
            <><span className="material-symbols-outlined text-sm mr-1 align-middle">check_circle</span>{t('Create Order')}</>
          )}
        </button>
      </div>
    </div>
  );
}
