import React, { useState, useEffect } from 'react';

interface PieceType {
  id: number;
  name_en: string;
  category: string;
  base_price: number;
  active: number;
}

interface OrderItem {
  piece_type: string;
  quantity: number;
  unit_price: number;
  fabric_source: 'customer' | 'shop';
  details: string;
}

interface OrderItemsFormProps {
  branchId: number;
  t: (key: string) => string;
  onConfirm: (items: OrderItem[], deliveryDate: string, paymentMethod: 'cash' | 'card') => void;
  onBack: () => void;
  initialItems?: OrderItem[];
  initialDeliveryDate?: string;
  initialPaymentMethod?: 'cash' | 'card';
}

function createEmptyItem(): OrderItem {
  return { piece_type: '', quantity: 1, unit_price: 0, fabric_source: 'customer', details: '' };
}

export default function OrderItemsForm({ branchId, t, onConfirm, onBack, initialItems, initialDeliveryDate, initialPaymentMethod }: OrderItemsFormProps) {
  const [pieceTypes, setPieceTypes] = useState<PieceType[]>([]);
  const [items, setItems] = useState<OrderItem[]>(initialItems && initialItems.length > 0 ? initialItems : [createEmptyItem()]);
  const [deliveryDate, setDeliveryDate] = useState(initialDeliveryDate || '');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>(initialPaymentMethod || 'cash');

  useEffect(() => {
    window.electronAPI.pieceTypes.getAll().then((pt: PieceType[]) => setPieceTypes(pt));
  }, []);

  const getBasePrice = (name: string) => pieceTypes.find(p => p.name_en === name)?.base_price || 0;

  const updateItem = (idx: number, patch: Partial<OrderItem>) => {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const handlePieceTypeChange = (idx: number, name: string) => {
    updateItem(idx, { piece_type: name, unit_price: getBasePrice(name) });
  };

  const addItem = () => setItems(prev => [...prev, createEmptyItem()]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const totalPrice = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);

  const handleNext = () => {
    const validItems = items.filter(i => i.piece_type);
    if (validItems.length === 0) { alert(t('Please add at least one item.')); return; }
    if (!deliveryDate) { alert(t('Please set a delivery date.')); return; }
    onConfirm(validItems, deliveryDate, paymentMethod);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="bg-surface-container-low rounded-xl p-4 relative">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-bold text-primary uppercase">#{idx + 1}</span>
              {items.length > 1 && (
                <button onClick={() => removeItem(idx)} className="text-outline hover:text-error transition-colors">
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Piece Type')}</label>
                <select value={item.piece_type} onChange={e => handlePieceTypeChange(idx, e.target.value)} className="input-field">
                  <option value="">{t('Select...')}</option>
                  {pieceTypes.filter(p => p.active !== 0).map(pt => (
                    <option key={pt.id} value={pt.name_en}>{pt.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Quantity')}</label>
                <input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Unit Price')}</label>
                <input type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} className="input-field" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Fabric Source')}</label>
                <div className="flex gap-2 mt-1">
                  {(['customer', 'shop'] as const).map(src => (
                    <button key={src} onClick={() => updateItem(idx, { fabric_source: src })}
                      className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors ${item.fabric_source === src ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'}`}>
                      {src === 'customer' ? t('Customer') : t('Shop')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Details')}</label>
              <input type="text" value={item.details} onChange={e => updateItem(idx, { details: e.target.value })} className="input-field" placeholder={t('Color, style, notes...')} />
            </div>
            <div className="mt-2 text-right font-bold text-on-surface">
              {(item.unit_price * item.quantity).toFixed(2)} {t('QAR')}
            </div>
          </div>
        ))}

        <button onClick={addItem} className="w-full py-3 border-2 border-dashed border-outline-variant/50 rounded-xl text-secondary hover:text-primary hover:border-primary transition-colors text-sm font-semibold">
          <span className="material-symbols-outlined text-sm mr-1 align-middle">add</span>
          {t('Add Another Item')}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Delivery Date')}</label>
          <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Payment Method')}</label>
          <div className="flex gap-2 mt-1">
            {(['cash', 'card'] as const).map(m => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg capitalize transition-colors ${paymentMethod === m ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'}`}>
                {t(m === 'cash' ? 'Cash' : 'Card')}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-xl p-4 flex justify-between items-center">
        <span className="text-sm font-semibold text-secondary">{t('Total')}</span>
        <span className="text-xl font-extrabold text-primary">{totalPrice.toFixed(2)} {t('QAR')}</span>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors">{t('Back')}</button>
        <button onClick={handleNext} className="btn-primary flex-1">
          {t('Continue to Worker Assignment')}
          <span className="material-symbols-outlined text-sm ml-2 align-middle">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
