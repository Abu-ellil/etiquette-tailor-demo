# Streamlined Production Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current fragmented multi-page workflow with a single guided wizard flow: Customer + Measurements → Order → Assign Cutter → Assign Tailors → Collect Payment.

**Architecture:** A new `WorkflowWizard` page component replaces separate NewOrder, OrderDetail, and TaskBoard pages for daily operations. The wizard is a multi-step state machine persisted to URL params so users can resume. Each step validates before advancing. Existing CRUD pages (Customers, Orders list, Settings) remain for management tasks.

**Tech Stack:** TypeScript 5.x, React 19, Electron 41, SQLite (better-sqlite3), Tailwind CSS v4, react-hook-form, date-fns

---

## Current vs Proposed Workflow

### Current (Fragmented)
1. Go to Customers page → Add customer (no measurements)
2. Go to Orders page → Click "New Order" → Fill form → Submit
3. Go to Orders list → Find order → Click order number → Order Detail
4. Click "Assign Workers" on item → Assign cutter → Assign tailor(s)
5. Cutter goes to Cutting Queue → Marks done
6. Tailor goes to My Tasks → Marks done
7. Admin goes back to Order Detail → Changes status manually
8. Admin records payments separately

### Proposed (Guided Wizard)
1. **Step 1 - Customer**: Search existing or create new customer + take measurements (all in one screen)
2. **Step 2 - Order**: Choose piece types, quantities, prices, delivery date
3. **Step 3 - Assign Cutter**: Select cutter from recommended list, see wage preview, confirm
4. **Step 4 - Assign Tailors**: Distribute pieces among tailors, see wage previews
5. **Step 5 - Review & Payment**: Summary of everything, record initial payment, confirm order

**Production tracking** (cutter/tailor marking done) stays on MyTasks/CuttingQueue pages — those are fine. The wizard handles the *creation and assignment* flow.

## File Structure

### New Files
```
src/renderer/pages/WorkflowWizard.tsx     # Multi-step wizard (replaces NewOrder for daily use)
src/renderer/components/StepIndicator.tsx  # Visual step progress bar
src/renderer/components/CustomerPicker.tsx # Customer search + inline create + measurements
src/renderer/components/OrderItemsForm.tsx # Multi-item order form (extracted from NewOrder)
src/renderer/components/WorkerAssigner.tsx # Cutter/tailor assignment with wages
src/renderer/components/OrderSummary.tsx   # Review summary + payment recording
```

### Modified Files
```
src/renderer/App.tsx                    # Add /workflow route, make it default "New Order" target
src/renderer/components/AppLayout.tsx   # "New Order" button → /workflow instead of /orders/new
src/renderer/pages/NewOrder.tsx         # Keep for advanced use but remove from primary nav
src/renderer/pages/OrderDetail.tsx      # Keep for viewing existing orders, remove assignment wizard
src/db/orders.ts                        # createOrderWithTasks() — single transaction for order+items+tasks+payments
src/main/index.ts                       # New IPC handler for createOrderWithTasks
src/main/preload.ts                     # Expose new API method
```

### Files Unchanged
```
src/renderer/pages/CuttingQueue.tsx     # Cutters still use this to mark tasks done
src/renderer/pages/MyTasks.tsx          # Tailors still use this to mark tasks done
src/renderer/pages/Orders.tsx           # Order list remains for viewing/searching
src/renderer/pages/Customers.tsx        # Customer management remains for editing
src/renderer/pages/Dashboard.tsx        # Unchanged
src/renderer/pages/TaskBoard.tsx        # Unchanged (admin overview)
src/db/schema.ts                        # No schema changes
src/db/customers.ts                     # No changes
src/db/workers.ts                       # No changes
```

---

## Task 1: Create the DB Transaction — `createOrderWithTasks`

**Files:**
- Modify: `src/db/orders.ts`
- Modify: `src/main/index.ts`
- Modify: `src/main/preload.ts`

This creates a single atomic function that creates an order + items + measurements + tasks + initial payment in one SQLite transaction.

- [ ] **Step 1: Add `createOrderWithTasks` to `src/db/orders.ts`**

Add after the existing `createOrder` function (around line 100). This function takes a single payload and creates everything atomically:

```ts
export interface WorkflowPayload {
  branch_id: number;
  customer_id: number;
  created_by: number;
  payment_method: 'cash' | 'card';
  delivery_date: string;
  receive_date?: string;
  fabric_source?: 'customer' | 'shop';
  notes?: string;
  items: {
    piece_type: string;
    quantity: number;
    unit_price: number;
    fabric_source?: 'customer' | 'shop';
    fabric_price?: number;
    details?: string;
    cutter_id?: number;
    cutter_wage_type?: 'percentage' | 'fixed';
    cutter_wage_rate?: number;
    tailors?: {
      worker_id: number;
      quantity: number;
      wage_type: 'percentage' | 'fixed';
      wage_rate: number;
    }[];
  }[];
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    length?: number;
    sleeve?: number;
    shoulder?: number;
    notes?: string;
  };
  initial_payment?: {
    amount: number;
    method: 'cash' | 'card';
    note?: string;
  };
}

export function createOrderWithTasks(payload: WorkflowPayload): { orderId: number; orderNumber: string } {
  const result = db.transaction(() => {
    const orderNumber = generateOrderNumber(payload.branch_id);
    const totalItems = payload.items.reduce((sum, i) => sum + i.quantity, 0);
    const totalPrice = payload.items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);

    db.prepare(`
      INSERT INTO orders (order_number, branch_id, customer_id, piece_type, details, price, paid, payment_method, status, receive_date, delivery_date, created_by, fabric_source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'intake', ?, ?, ?, ?)
    `).run(
      orderNumber,
      payload.branch_id,
      payload.customer_id,
      payload.items[0].piece_type,
      payload.notes || null,
      totalPrice,
      payload.initial_payment?.amount || 0,
      payload.payment_method,
      payload.receive_date || new Date().toISOString().split('T')[0],
      payload.delivery_date,
      payload.created_by,
      payload.fabric_source || 'customer'
    );

    const orderId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

    if (payload.measurements) {
      const m = payload.measurements;
      db.prepare(`
        INSERT INTO order_measurements (order_id, chest, waist, hips, length, sleeve, shoulder, notes, taken_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(orderId, m.chest || null, m.waist || null, m.hips || null, m.length || null, m.sleeve || null, m.shoulder || null, m.notes || null, payload.created_by);
    }

    for (const item of payload.items) {
      const itemTotal = item.unit_price * item.quantity;
      db.prepare(`
        INSERT INTO order_items (order_id, piece_type, quantity, unit_price, total_price, fabric_source, fabric_price, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        orderId, item.piece_type, item.quantity, item.unit_price, itemTotal,
        item.fabric_source || 'customer', item.fabric_price || 0, item.details || null
      );
      const itemId = (db.prepare('SELECT last_insert_rowid() as id').get() as { id: number }).id;

      if (item.cutter_id && item.cutter_wage_type && item.cutter_wage_rate !== undefined) {
        const wageAmount = item.cutter_wage_type === 'percentage'
          ? (itemTotal * item.cutter_wage_rate / 100)
          : item.cutter_wage_rate;
        db.prepare(`
          INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status)
          VALUES (?, ?, 'cutting', ?, ?, ?, ?, ?, 'pending')
        `).run(orderId, itemId, item.cutter_id, item.cutter_wage_type, item.cutter_wage_rate, wageAmount, 1);
      }

      if (item.tailors && item.tailors.length > 0) {
        for (const t of item.tailors) {
          const wageAmount = t.wage_type === 'percentage'
            ? (item.unit_price * t.quantity * t.wage_rate / 100)
            : t.wage_rate;
          db.prepare(`
            INSERT INTO order_tasks (order_id, order_item_id, task_type, assigned_to, wage_type, wage_rate, wage_amount, task_quantity, status)
            VALUES (?, ?, 'sewing', ?, ?, ?, ?, ?, 'pending')
          `).run(orderId, itemId, t.worker_id, t.wage_type, t.wage_rate, wageAmount, t.quantity);
        }
      }
    }

    if (payload.initial_payment && payload.initial_payment.amount > 0) {
      db.prepare(`
        INSERT INTO order_payments (order_id, amount, method, note, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(orderId, payload.initial_payment.amount, payload.initial_payment.method, payload.initial_payment.note || 'Initial payment', payload.created_by);
    }

    return { orderId, orderNumber };
  })();

  return result;
}
```

- [ ] **Step 2: Add IPC handler in `src/main/index.ts`**

Inside `registerIpcHandlers()`, after the existing `orders.create` handler, add:

```ts
ipcMain.handle('orders:createWithTasks', (_e, payload) => {
  return createOrderWithTasks(payload);
});
```

Add import at top: `import { createOrderWithTasks } from '../db/orders';` (if not already imported via index).

- [ ] **Step 3: Expose in `src/main/preload.ts`**

In the `orders` section of the `api` object, add:

```ts
createWithTasks: (payload: any) => ipcRenderer.invoke('orders:createWithTasks', payload),
```

- [ ] **Step 4: Verify the function compiles**

Run: `npx tsc --noEmit 2>&1 | Select-String "createOrderWithTasks|orders:createWithTasks"`
Expected: No errors related to new function.

- [ ] **Step 5: Commit**

```bash
git add src/db/orders.ts src/main/index.ts src/main/preload.ts
git commit -m "feat: add createOrderWithTasks atomic transaction for workflow wizard"
```

---

## Task 2: Create StepIndicator Component

**Files:**
- Create: `src/renderer/components/StepIndicator.tsx`

A horizontal step indicator showing progress through the wizard.

- [ ] **Step 1: Create `src/renderer/components/StepIndicator.tsx`**

```tsx
import React from 'react';

interface Step {
  label: string;
  icon: string;
}

interface StepIndicatorProps {
  steps: Step[];
  current: number;
  onStepClick?: (step: number) => void;
}

export default function StepIndicator({ steps, current, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center w-full">
      {steps.map((step, i) => {
        const isCompleted = i < current;
        const isCurrent = i === current;
        const isClickable = onStepClick && (i <= current);
        return (
          <React.Fragment key={i}>
            <button
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={`flex flex-col items-center gap-1.5 min-w-0 flex-shrink-0 transition-all duration-200 ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-200 ${
                  isCompleted
                    ? 'bg-primary text-on-primary shadow-sm'
                    : isCurrent
                      ? 'bg-primary-fixed text-on-primary-fixed ring-2 ring-primary ring-offset-2'
                      : 'bg-surface-container-high text-outline'
                }`}
              >
                {isCompleted ? (
                  <span className="material-symbols-outlined text-lg">check</span>
                ) : (
                  <span className="material-symbols-outlined text-lg">{step.icon}</span>
                )}
              </div>
              <span
                className={`text-xs font-semibold truncate max-w-[80px] ${
                  isCurrent ? 'text-primary' : isCompleted ? 'text-on-surface' : 'text-outline'
                }`}
              >
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-colors duration-200 ${
                  i < current ? 'bg-primary' : 'bg-surface-container-high'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/StepIndicator.tsx
git commit -m "feat: add StepIndicator wizard progress component"
```

---

## Task 3: Create CustomerPicker Component

**Files:**
- Create: `src/renderer/components/CustomerPicker.tsx`

This combines customer search, inline creation, and measurement taking in one component. This is Step 1 of the wizard.

- [ ] **Step 1: Create `src/renderer/components/CustomerPicker.tsx`**

```tsx
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
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementData>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const { register, handleSubmit, reset } = useForm({ defaultValues: { name: '', phone: '', notes: '' } });

  useEffect(() => {
    window.electronAPI.customers.getAll().then((c: Customer[]) => setAllCustomers(c));
  }, []);

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
    const updated = await window.electronAPI.customers.getAll();
    setAllCustomers(updated);
  };

  const handleMeasurementChange = (key: string, value: string) => {
    setMeasurements(prev => ({ ...prev, [key]: value ? parseFloat(value) : undefined }));
  };

  const handleConfirm = () => {
    if (!selected) return;
    const hasValues = Object.values(measurements).some(v => v !== undefined && v !== undefined);
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
            <input {...register('name', { required: true })} className="input-field" placeholder={t('Full name')} />
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

      {showMeasurements && selected && (
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/CustomerPicker.tsx
git commit -m "feat: add CustomerPicker component with search, create, and measurements"
```

---

## Task 4: Create OrderItemsForm Component

**Files:**
- Create: `src/renderer/components/OrderItemsForm.tsx`

Extracted and simplified from NewOrder.tsx. Step 2 of the wizard.

- [ ] **Step 1: Create `src/renderer/components/OrderItemsForm.tsx`**

```tsx
import React, { useState, useEffect } from 'react';

interface PieceType {
  id: number;
  name_en: string;
  name_ar: string;
  category: string;
  base_price: number;
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
  const [items, setItems] = useState<OrderItem[]>(initialItems || [createEmptyItem()]);
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
                <select
                  value={item.piece_type}
                  onChange={e => handlePieceTypeChange(idx, e.target.value)}
                  className="input-field"
                >
                  <option value="">{t('Select...')}</option>
                  {pieceTypes.filter(p => p.active !== 0).map(pt => (
                    <option key={pt.id} value={pt.name_en}>{pt.name_en}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Quantity')}</label>
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={e => updateItem(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Unit Price')}</label>
                <input
                  type="number"
                  step="0.01"
                  value={item.unit_price}
                  onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Fabric Source')}</label>
                <div className="flex gap-2 mt-1">
                  {(['customer', 'shop'] as const).map(src => (
                    <button
                      key={src}
                      onClick={() => updateItem(idx, { fabric_source: src })}
                      className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors ${
                        item.fabric_source === src
                          ? 'bg-primary text-on-primary'
                          : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'
                      }`}
                    >
                      {src === 'customer' ? t('Customer') : t('Shop')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Details')}</label>
              <input
                type="text"
                value={item.details}
                onChange={e => updateItem(idx, { details: e.target.value })}
                className="input-field"
                placeholder={t('Color, style, notes...')}
              />
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
          <input
            type="date"
            value={deliveryDate}
            onChange={e => setDeliveryDate(e.target.value)}
            className="input-field"
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">{t('Payment Method')}</label>
          <div className="flex gap-2 mt-1">
            {(['cash', 'card'] as const).map(m => (
              <button
                key={m}
                onClick={() => setPaymentMethod(m)}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg capitalize transition-colors ${
                  paymentMethod === m
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'
                }`}
              >
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
        <button onClick={onBack} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors">
          {t('Back')}
        </button>
        <button onClick={handleNext} className="btn-primary flex-1">
          {t('Continue to Worker Assignment')}
          <span className="material-symbols-outlined text-sm ml-2 align-middle">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/OrderItemsForm.tsx
git commit -m "feat: add OrderItemsForm component for wizard step 2"
```

---

## Task 5: Create WorkerAssigner Component

**Files:**
- Create: `src/renderer/components/WorkerAssigner.tsx`

Step 3 and 4 of the wizard combined — assign cutter then tailors per item.

- [ ] **Step 1: Create `src/renderer/components/WorkerAssigner.tsx`**

```tsx
import React, { useState, useEffect } from 'react';

interface Worker {
  id: number;
  name: string;
  worker_type: string | null;
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
      if (rate) {
        setRateCache(prev => ({ ...prev, [key]: rate }));
      }
      return rate;
    } catch {
      return null;
    }
  };

  const handleAssignCutter = async (itemIdx: number, cutterId: number) => {
    const rate = await getRate(cutterId, items[itemIdx].piece_type);
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a,
      cutter_id: cutterId,
      cutter_wage_type: rate?.wage_type || 'fixed',
      cutter_wage_rate: rate?.rate || 0,
    } : a));
  };

  const handleAddTailor = async (itemIdx: number, tailorId: number) => {
    const item = items[itemIdx];
    const rate = await getRate(tailorId, item.piece_type);
    const currentAssignedQty = assignments[itemIdx].tailors.reduce((s, t) => s + t.quantity, 0);
    const remainingQty = item.quantity - currentAssignedQty;
    if (remainingQty <= 0) return;

    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a,
      tailors: [...a.tailors, {
        worker_id: tailorId,
        quantity: Math.min(remainingQty, 1),
        wage_type: rate?.wage_type || 'fixed',
        wage_rate: rate?.rate || 0,
      }],
    } : a));
  };

  const updateTailorQty = (itemIdx: number, tailorIdx: number, qty: number) => {
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a,
      tailors: a.tailors.map((t, ti) => ti === tailorIdx ? { ...t, quantity: Math.max(1, qty) } : t),
    } : a));
  };

  const removeTailor = (itemIdx: number, tailorIdx: number) => {
    setAssignments(prev => prev.map((a, i) => i === itemIdx ? {
      ...a,
      tailors: a.tailors.filter((_, ti) => ti !== tailorIdx),
    } : a));
  };

  const calcCutterWage = (itemIdx: number) => {
    const a = assignments[itemIdx];
    const item = items[itemIdx];
    if (!a.cutter_wage_rate) return 0;
    return a.cutter_wage_type === 'percentage'
      ? (item.unit_price * item.quantity * a.cutter_wage_rate / 100)
      : a.cutter_wage_rate;
  };

  const calcTailorWage = (itemIdx: number, tailorIdx: number) => {
    const a = assignments[itemIdx];
    const item = items[itemIdx];
    const t = a.tailors[tailorIdx];
    if (!t) return 0;
    return t.wage_type === 'percentage'
      ? (item.unit_price * t.quantity * t.wage_rate / 100)
      : t.wage_rate;
  };

  const allCuttersAssigned = assignments.every(a => a.cutter_id);

  const handleNext = () => {
    if (!allCuttersAssigned) {
      alert(t('Please assign a cutter for each item.'));
      return;
    }
    onConfirm(assignments);
  };

  return (
    <div className="space-y-6">
      {items.map((item, itemIdx) => {
        const assignment = assignments[itemIdx];
        const assignedTailorQty = assignment.tailors.reduce((s, t) => s + t.quantity, 0);
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
                <span className="material-symbols-outlined text-sm align-middle mr-1">content_cut</span>
                {t('Assign Cutter')}
              </label>
              <select
                value={assignment.cutter_id || ''}
                onChange={e => e.target.value && handleAssignCutter(itemIdx, parseInt(e.target.value))}
                className="input-field"
              >
                <option value="">{t('Select cutter...')}</option>
                {cutters.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
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
                <span className="material-symbols-outlined text-sm align-middle mr-1">styler</span>
                {t('Assign Tailors')}
                {item.quantity > 1 && (
                  <span className="ml-2 text-xs font-normal">
                    ({assignedTailorQty}/{item.quantity} {t('assigned')})
                  </span>
                )}
              </label>

              {assignment.tailors.map((t, ti) => {
                const worker = tailors.find(w => w.id === t.worker_id);
                return (
                  <div key={ti} className="flex items-center gap-3 mb-2 bg-surface-container-lowest rounded-lg px-3 py-2">
                    <span className="text-sm font-medium flex-1">{worker?.name || t.worker_id}</span>
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={t.quantity}
                      onChange={e => updateTailorQty(itemIdx, ti, parseInt(e.target.value) || 1)}
                      className="input-field w-16 text-center h-9"
                    />
                    <span className="text-xs text-secondary">{calcTailorWage(itemIdx, ti).toFixed(2)} {t('QAR')}</span>
                    <button onClick={() => removeTailor(itemIdx, ti)} className="text-outline hover:text-error">
                      <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                  </div>
                );
              })}

              {remainingQty > 0 && (
                <select
                  value=""
                  onChange={e => e.target.value && handleAddTailor(itemIdx, parseInt(e.target.value))}
                  className="input-field text-sm"
                >
                  <option value="">{t('+ Add tailor...')}</option>
                  {tailors
                    .filter(w => !assignment.tailors.some(at => at.worker_id === w.id))
                    .map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>
              )}

              {remainingQty <= 0 && assignment.tailors.length > 0 && (
                <div className="text-xs text-tertiary font-semibold">
                  <span className="material-symbols-outlined text-xs align-middle mr-1">check_circle</span>
                  {t('All pieces assigned to tailors')}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors">
          {t('Back')}
        </button>
        <button onClick={handleNext} className="btn-primary flex-1">
          {t('Continue to Summary')}
          <span className="material-symbols-outlined text-sm ml-2 align-middle">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/WorkerAssigner.tsx
git commit -m "feat: add WorkerAssigner component for wizard steps 3-4"
```

---

## Task 6: Create OrderSummary Component

**Files:**
- Create: `src/renderer/components/OrderSummary.tsx`

Step 5 — review everything and record initial payment.

- [ ] **Step 1: Create `src/renderer/components/OrderSummary.tsx`**

```tsx
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

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface Worker {
  id: number;
  name: string;
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
          <div className="w-10 h-10 rounded-full bg-primary text-on-primary text-sm font-bold flex items-center justify-center">
            {customer.name.charAt(0)}
          </div>
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
                {a.tailors.map((t, ti) => (
                  <div key={ti} className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">styler</span>
                    <span>{t('Tailor')}: {getWorkerName(t.worker_id)} × {t.quantity}</span>
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
          <label className="text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-1 block">
            {t('Initial Payment')}
          </label>
          <input
            type="number"
            step="0.01"
            min={0}
            max={totalPrice}
            value={payment}
            onChange={e => setPayment(Math.max(0, parseFloat(e.target.value) || 0))}
            className="input-field"
            placeholder="0.00"
          />
          <div className="flex justify-between mt-2 text-sm">
            <span className="text-secondary">{t('Balance')}</span>
            <span className={`font-bold ${(totalPrice - payment) > 0 ? 'text-error' : 'text-tertiary'}`}>
              {(totalPrice - payment).toFixed(2)} {t('QAR')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors">
          {t('Back')}
        </button>
        <button
          onClick={() => onSubmit(payment)}
          disabled={submitting}
          className="btn-primary flex-1"
        >
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
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/OrderSummary.tsx
git commit -m "feat: add OrderSummary component for wizard step 5"
```

---

## Task 7: Create the WorkflowWizard Page

**Files:**
- Create: `src/renderer/pages/WorkflowWizard.tsx`

The main wizard page orchestrating all steps.

- [ ] **Step 1: Create `src/renderer/pages/WorkflowWizard.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/I18nContext';
import StepIndicator from '../components/StepIndicator';
import CustomerPicker from '../components/CustomerPicker';
import OrderItemsForm from '../components/OrderItemsForm';
import WorkerAssigner from '../components/WorkerAssigner';
import OrderSummary from '../components/OrderSummary';

interface Customer {
  id: number;
  name: string;
  phone: string;
}

interface Worker {
  id: number;
  name: string;
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

const STEPS = [
  { label: 'Customer', icon: 'person' },
  { label: 'Order', icon: 'shopping_bag' },
  { label: 'Workers', icon: 'group' },
  { label: 'Confirm', icon: 'check_circle' },
];

export default function WorkflowWizard() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [step, setStep] = useState(0);
  const [session, setSession] = useState<any>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerData, setCustomerData] = useState<Customer | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementData | undefined>();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');

  const [assignments, setAssignments] = useState<ItemAssignment[]>([]);

  React.useEffect(() => {
    window.electronAPI.auth.getSession().then((s: any) => setSession(s));
    window.electronAPI.workers.getAll().then((w: any[]) => setWorkers(w.filter(x => x.active === 1)));
  }, []);

  const handleCustomerSelect = useCallback((cId: number, measurementsData?: MeasurementData) => {
    setCustomerId(cId);
    setMeasurements(measurementsData);
    window.electronAPI.customers.get(cId).then((c: Customer) => setCustomerData(c));
    setStep(1);
  }, []);

  const handleOrderConfirm = useCallback((orderItems: OrderItem[], delDate: string, payMethod: 'cash' | 'card') => {
    setItems(orderItems);
    setDeliveryDate(delDate);
    setPaymentMethod(payMethod);
    setStep(2);
  }, []);

  const handleWorkerConfirm = useCallback((workerAssignments: ItemAssignment[]) => {
    setAssignments(workerAssignments);
    setStep(3);
  }, []);

  const handleSubmit = useCallback(async (initialPayment: number) => {
    if (!session || !customerId || items.length === 0) return;
    setSubmitting(true);

    try {
      const payload = {
        branch_id: session.branch_id,
        customer_id: customerId,
        created_by: session.userId,
        payment_method: paymentMethod,
        delivery_date: deliveryDate,
        receive_date: new Date().toISOString().split('T')[0],
        items: items.map((item, idx) => ({
          ...item,
          cutter_id: assignments[idx]?.cutter_id,
          cutter_wage_type: assignments[idx]?.cutter_wage_type,
          cutter_wage_rate: assignments[idx]?.cutter_wage_rate,
          tailors: assignments[idx]?.tailors || [],
        })),
        measurements: measurements,
        initial_payment: initialPayment > 0 ? {
          amount: initialPayment,
          method: paymentMethod,
          note: 'Initial payment',
        } : undefined,
      };

      const result = await window.electronAPI.orders.createWithTasks(payload);
      navigate(`/orders/${result.orderId}`);
    } catch (err) {
      console.error('Failed to create order:', err);
      alert(t('Failed to create order. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }, [session, customerId, items, assignments, measurements, deliveryDate, paymentMethod, navigate, t]);

  return (
    <div className="animate-fadeIn max-w-3xl mx-auto px-4 md:px-6 py-6">
      <div className="mb-8">
        <h1 className="font-headline text-2xl font-bold text-on-surface mb-1">{t('New Order')}</h1>
        <p className="text-secondary text-sm">{t('Create order, assign workers, and record payment in one flow.')}</p>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl shadow-[0px_20px_40px_rgba(25,28,29,0.06)] p-6 md:p-8">
        <div className="mb-8 px-2">
          <StepIndicator
            steps={STEPS}
            current={step}
            onStepClick={(s) => { if (s < step) setStep(s); }}
          />
        </div>

        {step === 0 && (
          <CustomerPicker
            branchId={session?.branch_id || 1}
            t={t}
            onSelect={handleCustomerSelect}
            selectedCustomerId={customerId}
          />
        )}

        {step === 1 && (
          <OrderItemsForm
            branchId={session?.branch_id || 1}
            t={t}
            onConfirm={handleOrderConfirm}
            onBack={() => setStep(0)}
            initialItems={items.length > 0 ? items : undefined}
            initialDeliveryDate={deliveryDate}
            initialPaymentMethod={paymentMethod}
          />
        )}

        {step === 2 && (
          <WorkerAssigner
            items={items}
            t={t}
            onConfirm={handleWorkerConfirm}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && customerData && (
          <OrderSummary
            customer={customerData}
            workers={workers}
            items={items}
            assignments={assignments}
            measurements={measurements}
            deliveryDate={deliveryDate}
            paymentMethod={paymentMethod}
            t={t}
            onSubmit={handleSubmit}
            onBack={() => setStep(2)}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/pages/WorkflowWizard.tsx
git commit -m "feat: add WorkflowWizard page orchestrating 4-step order creation flow"
```

---

## Task 8: Wire Up Routing and Navigation

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/AppLayout.tsx`

- [ ] **Step 1: Add route in `src/renderer/App.tsx`**

Add import at top:
```ts
import WorkflowWizard from './pages/WorkflowWizard';
```

Add route inside `<Routes>`, before the `/orders/new` route:
```tsx
<Route path="/workflow" element={<WorkflowWizard />} />
```

Add `/workflow` to the `admin`, `manager`, and `reception` allowed routes in `ROLE_ROUTES`.

- [ ] **Step 2: Update "New Order" button in `src/renderer/components/AppLayout.tsx`**

Change the "New Order" button's `onClick` from navigating to `/orders/new` to `/workflow`:

Find the existing button that navigates to `/orders/new` and change the navigate path to `/workflow`.

- [ ] **Step 3: Verify routing works**

Run: `npm run dev`
Navigate the app → click "New Order" → should open the wizard at `#/workflow`.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/AppLayout.tsx
git commit -m "feat: add /workflow route and update New Order button to use wizard"
```

---

## Task 9: Add UI Polish from Previous Audit

**Files:**
- Modify: `src/renderer/index.css`

Apply the critical CSS fixes from the UI/UX audit (research.md).

- [ ] **Step 1: Add missing design tokens to `@theme`**

Add these lines inside the `@theme { }` block in `index.css`, after the existing tokens:

```css
  --color-on-primary-fixed-variant: #5a1228;
  --color-tertiary-container: #f2e57b;
  --color-on-tertiary-container: #1f1c00;
  --color-secondary-fixed: #d0e1fb;
  --color-on-secondary-fixed: #1c2b3d;
  --color-on-secondary-container: #384351;
  --color-on-error: #ffffff;
```

- [ ] **Step 2: Add animations after the `@theme` block**

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalBackdropIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes modalContentIn {
  from { opacity: 0; transform: scale(0.95) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 150ms ease-out forwards;
}
```

- [ ] **Step 3: Add modal animations to existing `.modal-backdrop` and `.modal-content`**

Inside `@layer components`, update:
```css
.modal-backdrop {
  /* existing styles */
  animation: modalBackdropIn 200ms ease-out forwards;
}

.modal-content {
  /* existing styles */
  animation: modalContentIn 250ms ease-out forwards;
}
```

- [ ] **Step 4: Add compact input variant**

Inside `@layer components`, add:
```css
.input-field-sm {
  width: 100%;
  height: 2.5rem;
  background-color: var(--color-surface-container-high);
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 0.375rem 0.375rem 0 0;
  padding-left: 0.75rem;
  padding-right: 0.75rem;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-on-surface);
  outline: none;
  transition: border-color 0.2s;
}

.input-field-sm:focus {
  border-bottom-color: var(--color-primary);
}

.input-field-sm::placeholder {
  color: var(--color-on-surface-variant);
  opacity: 0.6;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/index.css
git commit -m "fix: add missing design tokens, animations, and input-field-sm variant"
```

---

## Task 10: Fix Critical Bugs from Audit

**Files:**
- Modify: `src/renderer/components/AppLayout.tsx`
- Modify: `src/renderer/pages/Backup.tsx`

- [ ] **Step 1: Fix RTL sidebar in `AppLayout.tsx`**

Find the line:
```ts
const sidebarHiddenClass = isRTL ? '-translate-x-full' : '-translate-x-full';
```
Replace with:
```ts
const sidebarHiddenClass = isRTL ? 'translate-x-full' : '-translate-x-full';
```

- [ ] **Step 2: Fix hardcoded colors in `Backup.tsx`**

Find the error banner using `bg-red-50 border-red-200 text-red-800` and replace with:
```
bg-error-container border border-error-container text-on-error-container
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/AppLayout.tsx src/renderer/pages/Backup.tsx
git commit -m "fix: RTL sidebar direction and Backup page hardcoded colors"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: Customer+measurements → Order → Assign cutter → Assign tailors → Payment — all covered by Tasks 3-7
- [x] **Placeholder scan**: No TBD, TODO, or "implement later" — all code is concrete
- [x] **Type consistency**: `WorkflowPayload` interface matches across DB function and wizard component; `ItemAssignment` type is consistent between WorkerAssigner and OrderSummary
- [x] **No new packages**: All components use existing React, react-hook-form, Tailwind, date-fns
- [x] **No schema changes**: Uses existing tables (orders, order_items, order_tasks, order_measurements, order_payments)
- [x] **Constitution check**: Balance = price - paid (maintained), order statuses unchanged, tech stack unchanged

---

**Plan saved.** Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session, batch execution with checkpoints

Which approach?
