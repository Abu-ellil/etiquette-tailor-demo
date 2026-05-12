import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StatusChip from '../components/StatusChip';
import { useTranslation } from '../contexts/I18nContext';

export default function OrderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, currency } = useTranslation();
  const [order, setOrder] = React.useState<any>(null);
  const [tasks, setTasks] = React.useState<any[]>([]);
  const [orderItems, setOrderItems] = React.useState<any[]>([]);
  const [pieceTypes, setPieceTypes] = React.useState<any[]>([]);
  const [measurements, setMeasurements] = React.useState<any>(null);
  const [workers, setWorkers] = React.useState<any[]>([]);
  const [payments, setPayments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editing, setEditing] = React.useState(false);
  const [showAddPayment, setShowAddPayment] = React.useState(false);
  const [originalPrice, setOriginalPrice] = React.useState(0);
  const [newPayment, setNewPayment] = React.useState<{ amount: string; method: 'cash' | 'card'; note: string }>({
    amount: '',
    method: 'cash',
    note: '',
  });
  const [session, setSession] = React.useState<any>(null);

  // Inline assignment state per item
  const [assigningItem, setAssigningItem] = React.useState<number | null>(null); // order_item_id
  const [recommendedWorkers, setRecommendedWorkers] = React.useState<any[]>([]);
  const [workerRates, setWorkerRates] = React.useState<Record<string, any>>({}); // key: `${workerId}-${pieceType}`
  const [inlineRate, setInlineRate] = React.useState<{ workerId: number; pieceType: string; wageType: 'percentage' | 'fixed'; rate: number } | null>(null);

  React.useEffect(() => {
    window.electronAPI.auth.getSession().then((s: any) => setSession(s));
  }, []);

  const loadOrder = React.useCallback(async () => {
    try {
      setLoading(true);
      const [orderData, taskData, measData, workerData, paymentData, itemsData, ptData] = await Promise.all([
        window.electronAPI.orders.get(Number(id)),
        window.electronAPI.orders.getTasks(Number(id)),
        window.electronAPI.orders.getMeasurements(Number(id)),
        window.electronAPI.workers.getAll(),
        window.electronAPI.orders.getPayments(Number(id)),
        window.electronAPI.orders.getItems(Number(id)),
        window.electronAPI.pieceTypes.getAll(),
      ]);
      setOrder(orderData);
      setTasks(taskData || []);
      setMeasurements(measData);
      setWorkers(workerData || []);
      setPayments(paymentData || []);
      setOrderItems(itemsData || []);
      setPieceTypes(ptData || []);
    } catch (err) {
      console.error('Failed to load order:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => { loadOrder(); }, [loadOrder]);

  const getCutters = () => workers.filter((w: any) => w.worker_type === 'master_cutter');
  const getTailors = () => workers.filter((w: any) => w.worker_type === 'tailor' || !w.worker_type);

  const getWorkerRate = async (workerId: number, pieceType: string): Promise<any> => {
    const key = `${workerId}-${pieceType}`;
    if (workerRates[key]) return workerRates[key];
    try {
      const rate = await window.electronAPI.workers.getActiveRate(workerId, pieceType);
      if (rate) {
        setWorkerRates(prev => ({ ...prev, [key]: rate }));
      }
      return rate;
    } catch { return null; }
  };

  const getBasePrice = (pieceType: string): number => {
    const pt = pieceTypes.find((p: any) => p.name_en === pieceType);
    return pt?.base_price || 0;
  };

  const calcWage = (basePrice: number, wageType: string, rate: number, qty: number): number => {
    return wageType === 'percentage' ? basePrice * (rate / 100) * qty : rate * qty;
  };

  const loadRecommended = async (pieceType: string, taskType: string) => {
    try {
      const recs = await window.electronAPI.workers.getRecommended(pieceType, taskType);
      setRecommendedWorkers(recs || []);
    } catch { setRecommendedWorkers([]); }
  };

  const handleStatusChange = async (taskId: number, currentStatus: string, taskType?: string) => {
    // Workers can only change tasks matching their type
    if (session?.role === 'worker' && taskType) {
      const taskTypeMap: Record<string, string> = { tailor: 'sewing', master_cutter: 'cutting' };
      const allowed = taskTypeMap[session.worker_type || ''];
      if (!allowed || taskType !== allowed) return;
    }
    const next: string | undefined = {
      pending: 'in_progress',
      in_progress: 'done',
    }[currentStatus];
    if (!next) return;
    await window.electronAPI.orders.updateTaskStatus(taskId, next);
    await loadOrder();
  };

  const handleSaveOrder = async () => {
    if (!order) return;
    try {
      await window.electronAPI.orders.update(order.id, {
        customer_id: order.customer_id,
        piece_type: order.piece_type,
        details: order.details,
        price: Number(order.price),
        payment_method: order.payment_method,
        status: order.status,
        delivery_date: order.delivery_date,
      });
      const newPrice = Number(order.price);
      if (newPrice !== originalPrice) {
        const nonDoneTasks = tasks.filter((t: any) => t.status !== 'done');
        if (nonDoneTasks.length > 0) {
          const recalc = window.confirm(
            t('Price changed from {oldPrice} QAR to {newPrice} QAR. This will recalculate wages for {count} task(s). Proceed?')
              .replace('{oldPrice}', originalPrice.toFixed(2))
              .replace('{newPrice}', newPrice.toFixed(2))
              .replace('{count}', String(nonDoneTasks.length))
              .replaceAll('QAR', t(currency))
          );
          if (recalc) {
            await window.electronAPI.orders.recalculateTaskWages(order.id, newPrice);
          }
        }
      }
      setEditing(false);
      await loadOrder();
    } catch (err) {
      console.error('Failed to save order:', err);
    }
  };

  const handleSaveMeasurements = async () => {
    if (!measurements) return;
    try {
      await window.electronAPI.orders.updateMeasurements(Number(id), measurements);
      await loadOrder();
    } catch (err) {
      console.error('Failed to save measurements:', err);
    }
  };

  // Assign cutter to an item
  const handleAssignCutter = async (itemId: number, pieceType: string, workerId: number) => {
    const rate = await getWorkerRate(workerId, pieceType);
    if (!rate) {
      setInlineRate({ workerId, pieceType, wageType: 'percentage', rate: 0 });
      return;
    }
    const item = orderItems.find((i: any) => i.id === itemId);
    const qty = item?.quantity || 1;
    const bp = getBasePrice(pieceType);
    const wageAmount = calcWage(bp, rate.wage_type, rate.rate, qty);
    await window.electronAPI.orders.createTask({
      order_id: Number(id),
      order_item_id: itemId,
      task_type: 'cutting',
      assigned_to: workerId,
      wage_type: rate.wage_type,
      wage_rate: rate.rate,
      wage_amount: wageAmount,
      task_quantity: qty,
      status: 'pending',
    });
    await loadOrder();
  };

  // Assign tailor to an item with specific quantity
  const handleAssignTailor = async (itemId: number, pieceType: string, workerId: number, qty: number) => {
    if (qty <= 0) return;
    const rate = await getWorkerRate(workerId, pieceType);
    if (!rate) {
      setInlineRate({ workerId, pieceType, wageType: 'percentage', rate: 0 });
      return;
    }
    const bp = getBasePrice(pieceType);
    const wageAmount = calcWage(bp, rate.wage_type, rate.rate, qty);
    await window.electronAPI.orders.createTask({
      order_id: Number(id),
      order_item_id: itemId,
      task_type: 'sewing',
      assigned_to: workerId,
      wage_type: rate.wage_type,
      wage_rate: rate.rate,
      wage_amount: wageAmount,
      task_quantity: qty,
      status: 'pending',
    });
    await loadOrder();
  };

  // Save inline rate and then assign
  const handleSaveInlineRate = async () => {
    if (!inlineRate || inlineRate.rate <= 0) return;
    try {
      await window.electronAPI.workers.setRate({
        user_id: inlineRate.workerId,
        piece_type: inlineRate.pieceType,
        wage_type: inlineRate.wageType,
        rate: inlineRate.rate,
      });
      // Clear rate cache
      const key = `${inlineRate.workerId}-${inlineRate.pieceType}`;
      setWorkerRates(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setInlineRate(null);
    } catch (err) {
      console.error('Failed to save rate:', err);
    }
  };

  const handleReassign = async (taskId: number, newWorkerId: number) => {
    try {
      const pieceType = order.piece_type;
      const rate = await window.electronAPI.workers.getActiveRate(newWorkerId, pieceType);
      if (!rate) {
        setInlineRate({ workerId: newWorkerId, pieceType, wageType: 'percentage', rate: 0 });
        return;
      }
      const pt = pieceTypes.find((p: any) => p.name_en === pieceType);
      const basePrice = pt?.base_price || Number(order.price);
      const task = tasks.find((t: any) => t.id === taskId);
      const qty = task?.task_quantity || 1;
      const wageAmount = rate.wage_type === 'percentage'
        ? basePrice * (rate.rate / 100) * qty
        : rate.rate * qty;
      await window.electronAPI.orders.reassignTask(
        taskId, newWorkerId, rate.wage_type, rate.rate, wageAmount
      );
      await loadOrder();
    } catch (err) {
      console.error('Failed to reassign task:', err);
    }
  };

  const handleAddPayment = async () => {
    if (!order) return;
    const amount = Number(newPayment.amount);
    if (!amount || amount <= 0) {
      alert(t('Please enter a valid amount.'));
      return;
    }
    const bal = Number(order.price) - totalPaid;
    if (amount > bal + 0.01) {
      alert(t('Payment amount exceeds the balance due ({balance} QAR).').replace('{balance}', bal.toFixed(2)).replaceAll('QAR', t(currency)));
      return;
    }
    try {
      await window.electronAPI.orders.addPayment(
        order.id,
        amount,
        newPayment.method,
        newPayment.note || null,
      );
      setShowAddPayment(false);
      setNewPayment({ amount: '', method: 'cash', note: '' });
      await loadOrder();
    } catch (err) {
      console.error('Failed to add payment:', err);
      alert(t('Failed to record payment.'));
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    if (!confirm(t('Delete this payment record? This will recalculate the order balance.'))) return;
    try {
      await window.electronAPI.orders.deletePayment(paymentId);
      await loadOrder();
    } catch (err) {
      console.error('Failed to delete payment:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading order...')}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined text-5xl mb-3 text-outline">error</span>
        <p className="font-headline font-bold text-lg">{t('Order not found')}</p>
        <button onClick={() => navigate('/orders')} className="btn-primary mt-4 px-6 py-2 text-sm">{t('Back to Orders')}</button>
      </div>
    );
  }

  // Calculate paid from actual payment records to stay in sync
  const totalPaid = payments.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
  const balance = (Number(order.price) || 0) - totalPaid;
  const isWorker = session?.role === 'worker';

  // Calculate assigned quantities per item
  const getItemTasks = (itemId: number) => tasks.filter((t: any) => t.order_item_id === itemId);
  const getItemAssignedQty = (itemId: number, taskType: string) =>
    getItemTasks(itemId).filter((t: any) => t.task_type === taskType).reduce((s: number, t: any) => s + (t.task_quantity || 1), 0);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            {t('Order #{number}', { number: order.order_number })}
          </h1>
          <p className="text-secondary mt-1 truncate">
            {order.customer_name} {order.customer_phone && `· ${order.customer_phone}`}
          </p>
        </div>
        <div className="flex gap-3">
          {!isWorker && (
            !editing ? (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(true); setOriginalPrice(Number(order.price)); }} className="btn-primary px-6 py-3 text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">edit</span>
                  {t('Edit Order')}
                </button>
                <button onClick={() => navigate(`/invoice/${order.id}`)} className="px-6 py-3 text-sm font-semibold bg-surface-container-high hover:bg-surface-container-highest rounded-lg flex items-center gap-2 transition-colors">
                  <span className="material-symbols-outlined text-base">print</span>
                  {t('Print Invoice')}
                </button>
                <button
                  onClick={() => {
                    const phone = order.customer_phone?.replace(/[^0-9]/g, '') || '';
                    if (!phone) { alert(t('No phone number for this customer.')); return; }
                    const bal = (Number(order.price) || 0) - totalPaid;
                    const items = orderItems.length > 0
                      ? orderItems.map((it: any) => `• ${it.piece_type} ×${it.quantity || 1}`).join('\n')
                      : `• ${order.piece_type}`;
                    const msg = `*Etiquette Tailor - Order Update*

*Order:* ${order.order_number}
*Customer:* ${order.customer_name}
*Status:* ${order.status}

*Items:*
${items}

*Price:* ${Number(order.price).toFixed(0)} ${t(currency)}
*Paid:* ${totalPaid.toFixed(0)} ${t(currency)}
${bal > 0.01 ? `*Balance Due:* ${bal.toFixed(0)} ${t(currency)}` : '*Fully Paid*'}
*Delivery:* ${order.delivery_date || '--'}

${order.details ? `*Notes:* ${order.details}` : ''}`;
                    window.electronAPI.shell.openExternal(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`);
                  }}
                  className="px-6 py-3 text-sm font-semibold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg flex items-center gap-2 transition-colors"
                  title={t('Send via WhatsApp')}
                >
                  <span className="material-symbols-outlined text-base">chat</span>
                  {t('WhatsApp')}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => { setEditing(false); loadOrder(); }} className="px-6 py-3 text-sm text-secondary hover:bg-surface-container-high rounded-lg">{t('Cancel')}</button>
                <button onClick={handleSaveOrder} className="btn-primary px-6 py-3 text-sm">{t('Save')}</button>
              </div>
            )
          )}
          <button onClick={() => navigate('/orders')} className="px-4 py-3 text-sm text-secondary hover:bg-surface-container-high rounded-lg flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {t('Back')}
          </button>
        </div>
      </div>

      {/* Payment Summary Bar */}
      {!isWorker && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface-container-lowest rounded-xl p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-secondary mb-1">{t('Total Price')}</p>
            <p className="text-2xl font-extrabold text-on-surface">{Number(order.price).toFixed(2)} <span className="text-sm font-semibold text-secondary">{t(currency)}</span></p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-5 text-center">
            <p className="text-xs uppercase tracking-widest text-secondary mb-1">{t('Total Paid')}</p>
            <p className="text-2xl font-extrabold text-tertiary">{totalPaid.toFixed(2)} <span className="text-sm font-semibold text-secondary">{t(currency)}</span></p>
          </div>
          <div className={`rounded-xl p-5 text-center ${balance > 0.01 ? 'bg-error/10 border-2 border-error/20' : 'bg-tertiary-container/20 border-2 border-tertiary-container/30'}`}>
            <p className="text-xs uppercase tracking-widest text-secondary mb-1">{t('Balance Due')}</p>
            <p className={`text-2xl font-extrabold ${balance > 0.01 ? 'text-error' : 'text-tertiary'}`}>
              {balance > 0.01 ? balance.toFixed(2) : '0.00'} <span className="text-sm font-semibold text-secondary">{t(currency)}</span>
            </p>
            {balance <= 0.01 && (
              <span className="inline-flex items-center gap-1 text-xs text-tertiary font-semibold mt-1">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {t('Fully Paid')}
              </span>
            )}
          </div>
          {balance > 0.01 && (
            <button
              onClick={() => setShowAddPayment(true)}
              className="w-full mt-2 py-3 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <span className="material-symbols-outlined">payments</span>
              {t('Add Payment')}
            </button>
          )}
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="modal-backdrop" onClick={() => setShowAddPayment(false)}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={e => e.stopPropagation()}>
            <div className="modal-content w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-6">
                <h2 className="text-xl font-headline font-bold mb-4">{t('Record Payment')}</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase text-secondary mb-1">{t('Amount')} ({t(currency)})</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newPayment.amount}
                      onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
                      className="input-field w-full"
                      placeholder="0.00"
                      autoFocus
                    />
                    {balance > 0 && (
                      <button
                        type="button"
                        onClick={() => setNewPayment({...newPayment, amount: balance.toFixed(2)})}
                        className="text-xs text-primary hover:underline mt-1"
                      >
                        {t('Pay full balance')}: {balance.toFixed(2)}
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-secondary mb-1">{t('Method')}</label>
                    <select
                      value={newPayment.method}
                      onChange={e => setNewPayment({...newPayment, method: e.target.value as 'cash' | 'card'})}
                      className="input-field w-full"
                    >
                      <option value="cash">{t('Cash')}</option>
                      <option value="card">{t('Card')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase text-secondary mb-1">{t('Note')} ({t('optional')})</label>
                    <input
                      type="text"
                      value={newPayment.note}
                      onChange={e => setNewPayment({...newPayment, note: e.target.value})}
                      className="input-field w-full"
                      placeholder={t('Payment note...')}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddPayment(false)} className="px-4 py-2 text-sm text-secondary hover:bg-surface-container-high rounded-lg">
                    {t('Cancel')}
                  </button>
                  <button
                    onClick={async () => {
                      if (!newPayment.amount || Number(newPayment.amount) <= 0) return;
                      try {
                        await window.electronAPI.orders.addPayment(Number(id), Number(newPayment.amount), newPayment.method, newPayment.note || null);
                        setShowAddPayment(false);
                        setNewPayment({ amount: '', method: 'cash', note: '' });
                        loadOrder();
                      } catch (err) {
                        console.error('Payment failed:', err);
                      }
                    }}
                    className="btn-primary px-6 py-2 text-sm"
                    disabled={!newPayment.amount || Number(newPayment.amount) <= 0}
                  >
                    {t('Save Payment')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          {/* Order Details */}
          <div className="bg-surface-container-lowest rounded-xl p-6">
            <h3 className="text-lg font-headline font-bold mb-4">{t('Order Details')}</h3>
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Piece Type')}</label>
                  <input value={order.piece_type} onChange={(e) => setOrder({...order, piece_type: e.target.value})} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Status')}</label>
                  <select value={order.status} onChange={(e) => setOrder({...order, status: e.target.value})} className="input-field w-full appearance-none">
                    <option value="intake">{t('Intake')}</option>
                    <option value="cutting">{t('Cutting')}</option>
                    <option value="sewing">{t('Sewing')}</option>
                    <option value="ready">{t('Ready')}</option>
                    <option value="delivered">{t('Delivered')}</option>
                  </select>
                </div>
                {!isWorker && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{`${t('Price')} (${t(currency)})`}</label>
                      <input type="number" value={order.price} onChange={(e) => setOrder({...order, price: e.target.value})} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Payment')}</label>
                      <select value={order.payment_method} onChange={(e) => setOrder({...order, payment_method: e.target.value})} className="input-field w-full appearance-none">
                        <option value="cash">{t('Cash')}</option>
                        <option value="card">{t('Card')}</option>
                      </select>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Due Date')}</label>
                  <input type="date" value={order.delivery_date || ''} onChange={(e) => setOrder({...order, delivery_date: e.target.value})} className="input-field w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Details')}</label>
                  <textarea value={order.details || ''} onChange={(e) => setOrder({...order, details: e.target.value})} className="input-field w-full min-h-[80px]" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div><span className="text-secondary">{t('Piece Type')}:</span> <span className="font-semibold">{order.piece_type}</span></div>
                <div><span className="text-secondary">{t('Status')}:</span> <StatusChip status={order.status} /></div>
                {!isWorker && (<>
                  <div><span className="text-secondary">{t('Payment')}:</span> <span className="font-semibold capitalize">{order.payment_method}</span></div>
                </>)}
                <div><span className="text-secondary">{t('Due Date')}:</span> <span className="font-semibold">{order.delivery_date || '--'}</span></div>
                <div><span className="text-secondary">{t('Details')}:</span> <span className="font-semibold">{order.details || '--'}</span></div>
              </div>
            )}
          </div>

          {/* Order Items with inline worker assignment */}
          {orderItems.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6">
              <h3 className="text-lg font-headline font-bold mb-4">{t('Order Items')}</h3>
              <div className="space-y-4">
                {orderItems.map((item: any, idx: number) => {
                  const itemTasks = getItemTasks(item.id);
                  const cutterTasks = itemTasks.filter((t: any) => t.task_type === 'cutting');
                  const sewingTasks = itemTasks.filter((t: any) => t.task_type === 'sewing');
                  const bp = getBasePrice(item.piece_type);
                  const isAssigning = assigningItem === item.id;
                  const hasCutter = cutterTasks.length > 0;
                  const assignedSewingQty = sewingTasks.reduce((s: number, t: any) => s + (t.task_quantity || 1), 0);
                  const sewingComplete = assignedSewingQty >= item.quantity;

                  return (
                    <div key={item.id} className="border border-outline-variant/20 rounded-xl overflow-hidden">
                      {/* Item header */}
                      <div className="bg-surface-container-low p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-bold text-primary">#{idx + 1}</span>
                          <span className="font-semibold text-on-surface">{item.piece_type}</span>
                          <span className="text-xs text-secondary">×{item.quantity}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${item.fabric_source === 'customer' ? 'bg-primary-container/20 text-primary' : 'bg-tertiary-container/20 text-tertiary'}`}>
                            {item.fabric_source === 'customer' ? t('Customer') : t('Shop')}
                          </span>
                        </div>
                        {!isWorker && (
                          <button
                            onClick={() => {
                              if (isAssigning) {
                                setAssigningItem(null);
                              } else {
                                setAssigningItem(item.id);
                                loadRecommended(item.piece_type, 'sewing');
                              }
                            }}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all ${
                              isAssigning ? 'bg-surface-container-high text-secondary' : 'bg-primary/10 text-primary hover:bg-primary/20'
                            }`}
                          >
                            <span className="material-symbols-outlined text-sm">{isAssigning ? 'close' : 'person_add'}</span>
                            {isAssigning ? t('Close') : t('Assign Workers')}
                          </button>
                        )}
                      </div>

                      {/* Existing tasks for this item */}
                      {itemTasks.length > 0 && (
                        <div className="border-t border-outline-variant/10 p-4 space-y-2">
                          {cutterTasks.map((task: any) => (
                            <div key={task.id} className="flex items-center justify-between text-sm bg-surface p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-base">content_cut</span>
                                <span className="font-semibold capitalize">{t('cutting')}</span>
                                <span className="text-secondary">· {task.worker_name || t('Unassigned')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {!isWorker && <span className="text-xs text-secondary">{Number(task.wage_amount || 0).toFixed(2)} {t(currency)}</span>}
                                <StatusChip status={task.status} onClick={() => handleStatusChange(task.id, task.status, 'cutting')} />
                              </div>
                            </div>
                          ))}
                          {sewingTasks.map((task: any) => (
                            <div key={task.id} className="flex items-center justify-between text-sm bg-surface p-2 rounded-lg">
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary text-base">print</span>
                                <span className="font-semibold capitalize">{t('sewing')}</span>
                                <span className="text-secondary">· {task.worker_name || t('Unassigned')}</span>
                                {task.task_quantity > 1 && <span className="text-xs text-secondary">(×{task.task_quantity})</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {!isWorker && <span className="text-xs text-secondary">{Number(task.wage_amount || 0).toFixed(2)} {t(currency)}</span>}
                                <StatusChip status={task.status} onClick={() => handleStatusChange(task.id, task.status, 'sewing')} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Inline assignment panel */}
                      {isAssigning && (
                        <div className="border-t border-outline-variant/10 p-4 space-y-4 bg-surface-container-lowest/50">
                          {/* Cutter assignment */}
                          <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-secondary mb-2">{t('Assign Cutter')}</label>
                            {hasCutter ? (
                              <p className="text-xs text-secondary flex items-center gap-1">
                                <span className="material-symbols-outlined text-tertiary text-sm">check_circle</span>
                                {t('Cutter assigned')} ({cutterTasks[0].worker_name})
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {getCutters().map((w: any) => {
                                  const rec = recommendedWorkers.find((r: any) => r.user_id === w.id && r.worker_type === 'master_cutter');
                                  return (
                                    <button
                                      key={w.id}
                                      onClick={() => handleAssignCutter(item.id, item.piece_type, w.id)}
                                      className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                                        rec?.has_rate
                                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                          : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'
                                      }`}
                                    >
                                      {w.name}
                                      {rec?.has_rate && <span className="text-xs opacity-70">({rec.rate}{rec.wage_type === 'percentage' ? '%' : ` ${t(currency)}`})</span>}
                                    </button>
                                  );
                                })}
                                {getCutters().length === 0 && (
                                  <p className="text-xs text-secondary">{t('No cutters available. Add workers first.')}</p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Tailor assignment */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-xs font-semibold uppercase tracking-widest text-secondary">
                                {t('Assign Tailors')} ({assignedSewingQty}/{item.quantity})
                              </label>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-2 bg-surface-container-high rounded-full mb-3 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${sewingComplete ? 'bg-tertiary' : 'bg-primary'}`}
                                style={{ width: `${Math.min(100, (assignedSewingQty / item.quantity) * 100)}%` }}
                              />
                            </div>

                            {sewingComplete ? (
                              <p className="text-xs text-secondary flex items-center gap-1">
                                <span className="material-symbols-outlined text-tertiary text-sm">check_circle</span>
                                {t('All pieces assigned')}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {/* Recommended tailors first */}
                                {recommendedWorkers
                                  .filter((r: any) => r.worker_type !== 'master_cutter' && r.has_rate)
                                  .map((rec: any) => {
                                    const alreadyAssigned = sewingTasks.some((t: any) => t.assigned_to === rec.user_id);
                                    if (alreadyAssigned) return null;
                                    const remaining = item.quantity - assignedSewingQty;
                                    const wage = calcWage(bp, rec.wage_type, rec.rate, 1);
                                    return (
                                      <div key={rec.user_id} className="flex items-center gap-2 bg-primary/5 border border-primary/10 rounded-lg p-2">
                                        <span className="material-symbols-outlined text-primary text-sm">recommend</span>
                                        <span className="text-sm font-semibold text-on-surface flex-1">{rec.worker_name}</span>
                                        <span className="text-xs text-secondary">{rec.rate}{rec.wage_type === 'percentage' ? '%' : ` ${t(currency)}`}</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={remaining}
                                          defaultValue={Math.min(remaining, 1)}
                                          className="input-field w-16 text-sm text-center py-1"
                                          id={`tailor-qty-${rec.user_id}`}
                                        />
                                        <span className="text-xs text-secondary">× {bp} =</span>
                                        <span className="text-xs font-bold text-primary" id={`tailor-wage-${rec.user_id}`}>{wage.toFixed(2)}</span>
                                        <button
                                          onClick={async () => {
                                            const qtyInput = document.getElementById(`tailor-qty-${rec.user_id}`) as HTMLInputElement;
                                            const qty = Math.max(1, Math.min(remaining, Number(qtyInput?.value || 1)));
                                            await handleAssignTailor(item.id, item.piece_type, rec.user_id, qty);
                                          }}
                                          className="btn-primary px-3 py-1 text-xs rounded-lg"
                                        >
                                          {t('Assign')}
                                        </button>
                                      </div>
                                    );
                                  })}

                                {/* All other tailors */}
                                {getTailors()
                                  .filter((w: any) => !sewingTasks.some((t: any) => t.assigned_to === w.id))
                                  .filter((w: any) => !recommendedWorkers.some((r: any) => r.user_id === w.id && r.has_rate))
                                  .map((w: any) => {
                                    const remaining = item.quantity - assignedSewingQty;
                                    return (
                                      <div key={w.id} className="flex items-center gap-2 bg-surface rounded-lg p-2">
                                        <span className="text-sm text-on-surface flex-1">{w.name}</span>
                                        <span className="text-xs text-secondary">{t('No rate set')}</span>
                                        <input
                                          type="number"
                                          min={1}
                                          max={remaining}
                                          defaultValue={Math.min(remaining, 1)}
                                          className="input-field w-16 text-sm text-center py-1"
                                          id={`tailor-qty-${w.id}`}
                                        />
                                        <button
                                          onClick={async () => {
                                            const qtyInput = document.getElementById(`tailor-qty-${w.id}`) as HTMLInputElement;
                                            const qty = Math.max(1, Math.min(remaining, Number(qtyInput?.value || 1)));
                                            await handleAssignTailor(item.id, item.piece_type, w.id, qty);
                                          }}
                                          className="px-3 py-1 text-xs rounded-lg bg-surface-container-high text-secondary hover:bg-surface-container-highest transition-colors"
                                        >
                                          {t('Assign')}
                                        </button>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Items fallback when no order_items */}
          {orderItems.length === 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6">
              <h3 className="text-lg font-headline font-bold mb-4">{t('Piece Type')}</h3>
              <p className="text-sm font-semibold">{order.piece_type}</p>
            </div>
          )}

          {/* Payment History */}
          {!isWorker && (
            <div className="bg-surface-container-lowest rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-headline font-bold">{t('Payment History')}</h3>
                {balance > 0.01 && order.status !== 'delivered' && (
                  <button
                    onClick={() => setShowAddPayment(true)}
                    className="btn-primary px-4 py-2 text-sm flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    {t('Record Payment')}
                  </button>
                )}
              </div>

              {payments.length === 0 ? (
                <p className="text-secondary text-sm py-4">{t('No payments recorded yet.')}</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p: any, idx: number) => (
                    <div key={p.id} className="bg-surface rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-secondary font-mono w-6">#{idx + 1}</span>
                        <div>
                          <span className="font-bold text-on-surface">{Number(p.amount).toFixed(2)} {t(currency)}</span>
                          <span className={`ml-3 text-xs px-2 py-0.5 rounded-full font-semibold ${p.method === 'cash' ? 'bg-tertiary-container/20 text-tertiary' : 'bg-primary-container/20 text-primary'}`}>
                            {p.method === 'cash' ? t('Cash') : t('Card')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.note && <span className="text-xs text-secondary italic">"{p.note}"</span>}
                        <span className="text-xs text-secondary">{new Date(p.created_at).toLocaleString()}</span>
                        {order.status !== 'delivered' && (
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="text-xs text-error hover:underline"
                            title={t('Delete payment')}
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Measurements */}
          <div className="bg-surface-container-lowest rounded-xl p-6">
            <h3 className="text-lg font-headline font-bold mb-4">{t('Measurements')}</h3>
            {measurements ? (
              <div className="grid grid-cols-3 gap-4">
                {['chest', 'waist', 'hips', 'length', 'sleeve', 'shoulder'].map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t(`${field.charAt(0).toUpperCase() + field.slice(1)}`)}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={measurements[field] || ''}
                      onChange={(e) => setMeasurements({...measurements, [field]: e.target.value ? Number(e.target.value) : null})}
                      className="input-field w-full"
                      placeholder="--"
                    />
                  </div>
                ))}
                <div className="col-span-3">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Notes')}</label>
                  <textarea value={measurements.notes || ''} onChange={(e) => setMeasurements({...measurements, notes: e.target.value})} className="input-field w-full min-h-[60px]" />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button onClick={handleSaveMeasurements} className="btn-primary px-6 py-2 text-sm">{t('Save Measurements')}</button>
                </div>
              </div>
            ) : (
              <p className="text-secondary text-sm">{t('No measurements recorded for this order.')}</p>
            )}
          </div>
        </div>

        {/* Right sidebar - Tasks overview */}
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-xl p-6">
            <h3 className="text-lg font-headline font-bold mb-3">{t('Tasks')}</h3>
            <div className="space-y-2">
              {tasks.length === 0 ? (
                <div className="text-center py-6">
                  <span className="material-symbols-outlined text-4xl text-outline mb-2 block">assignment_ind</span>
                  <p className="text-secondary text-sm">{t('No tasks assigned yet.')}</p>
                  {!isWorker && orderItems.length > 0 && (
                    <p className="text-xs text-primary mt-1">{t('Use "Assign Workers" on each item above.')}</p>
                  )}
                </div>
              ) : tasks.map((task: any) => (
                <div key={task.id} className="bg-surface rounded-lg p-3 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm capitalize">{t(task.task_type)}</span>
                    <StatusChip status={task.status} onClick={() => handleStatusChange(task.id, task.status, task.task_type)} />                  </div>
                  <div className="flex justify-between items-center text-xs text-secondary">
                    <span>{task.worker_name || t('Unassigned')}</span>
                    {!isWorker && <span>{Number(task.wage_amount || 0).toFixed(2)} {t(currency)}</span>}
                  </div>
                  {task.task_quantity > 1 && (
                    <div className="text-xs text-secondary">×{task.task_quantity}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Total wages summary */}
          {!isWorker && tasks.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6">
              <h3 className="text-sm font-headline font-bold mb-2 uppercase tracking-widest text-secondary">{t('Wage Summary')}</h3>
              <div className="flex justify-between items-center">
                <span className="text-sm text-secondary">{t('Total Wages')}</span>
                <span className="text-lg font-extrabold text-on-surface">
                  {tasks.reduce((s: number, t: any) => s + Number(t.wage_amount || 0), 0).toFixed(2)} {t(currency)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Inline Rate Creation Modal */}
      {inlineRate && (
        <div className="modal-backdrop" onClick={() => setInlineRate(null)}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-6">
                <h2 className="text-lg font-headline font-bold mb-1">{t('Set Worker Rate')}</h2>
                <p className="text-sm text-secondary mb-4">
                  {t('No rate configured for this worker and piece type. Create one now.')}
                </p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setInlineRate({ ...inlineRate, wageType: 'percentage' })}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm ${inlineRate.wageType === 'percentage' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary'}`}
                    >
                      {t('Percentage')}
                    </button>
                    <button
                      onClick={() => setInlineRate({ ...inlineRate, wageType: 'fixed' })}
                      className={`flex-1 py-2 rounded-lg font-bold text-sm ${inlineRate.wageType === 'fixed' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-secondary'}`}
                    >
                      {t('Fixed')}
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full"
                    placeholder={inlineRate.wageType === 'percentage' ? t('e.g. 18') : t('Amount')}
                    value={inlineRate.rate || ''}
                    onChange={(e) => setInlineRate({ ...inlineRate, rate: Number(e.target.value) })}
                    autoFocus
                  />
                  {inlineRate.rate > 0 && (
                    <p className="text-xs text-secondary">
                      {t('Preview')}: {getBasePrice(inlineRate.pieceType)} × {inlineRate.rate}{inlineRate.wageType === 'percentage' ? '%' : ` ${t(currency)}`} = <strong className="text-primary">{calcWage(getBasePrice(inlineRate.pieceType), inlineRate.wageType, inlineRate.rate, 1).toFixed(2)} {t(currency)}</strong>
                    </p>
                  )}
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setInlineRate(null)} className="px-4 py-2 text-sm text-secondary">{t('Cancel')}</button>
                  <button onClick={handleSaveInlineRate} disabled={inlineRate.rate <= 0} className="btn-primary px-6 py-2 text-sm disabled:opacity-50">{t('Save & Assign')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <div className="modal-backdrop" onClick={() => setShowAddPayment(false)}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-6">
                <h2 className="text-xl font-headline font-bold mb-2">{t('Record Payment')}</h2>
                <p className="text-sm text-secondary mb-5">
                  {t('Balance due')}: <span className="font-bold text-error">{balance.toFixed(2)} {t(currency)}</span>
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{`${t('Amount')} (${t(currency)})`}</label>
                    <input
                      type="number"
                      step="0.01"
                      value={newPayment.amount}
                      onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                      className="input-field w-full"
                      placeholder={balance.toFixed(2)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Payment Method')}</label>
                    <div className="flex gap-2">
                      {(['cash', 'card'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setNewPayment({...newPayment, method})}
                          className={`flex-1 py-3 rounded-lg font-bold transition-all capitalize text-sm ${
                            newPayment.method === method
                              ? 'bg-primary text-on-primary shadow-sm'
                              : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'
                          }`}
                        >
                          {method === 'cash' ? t('Cash') : t('Card')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Note (optional)')}</label>
                    <input
                      type="text"
                      value={newPayment.note}
                      onChange={(e) => setNewPayment({...newPayment, note: e.target.value})}
                      className="input-field w-full"
                      placeholder={t('e.g. Second installment')}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setShowAddPayment(false)} className="px-4 py-2 text-sm text-secondary">{t('Cancel')}</button>
                  <button
                    onClick={handleAddPayment}
                    disabled={!newPayment.amount || Number(newPayment.amount) <= 0}
                    className="btn-primary px-6 py-2 text-sm disabled:opacity-50"
                  >
                    {t('Record Payment')}
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
