import React, { useEffect, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { format, isPast, parseISO } from 'date-fns';
import { useTranslation } from '../contexts/I18nContext';
import { useActiveBranch } from '../contexts/BranchContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface Order {
  id: number;
  order_number: string;
  branch_id: number;
  customer_id: number;
  piece_type: string;
  details?: string;
  price: number;
  paid: number;
  balance: number;
  payment_method: 'cash' | 'card';
  status: string;
  receive_date?: string;
  delivery_date?: string;
  created_by?: number;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  branch_name?: string;
  branch_name_ar?: string;
  branch_prefix?: string;
}

interface OrderStats {
  total: number;
  in_progress: number;
  ready: number;
  delivered: number;
  overdue: number;
  revenue: number;
}

/* ------------------------------------------------------------------ */
/*  Status helpers                                                     */
/* ------------------------------------------------------------------ */
type FilterTab = 'all' | 'in_progress' | 'ready' | 'delivered' | 'late' | 'ready_unpaid';

const DB_STATUSES_FOR_PROGRESS = ['intake', 'cutting', 'sewing'];

/* Display status returns a translation key suffix; the actual label comes from t() */
function displayStatusKey(order: Order): string {
  if (order.status === 'delivered') return 'delivered';
  if (order.status === 'ready') return 'ready';
  if (order.delivery_date && isPast(parseISO(order.delivery_date))) return 'late';
  return 'inProgress';
}

const STATUS_DISPLAY_LABELS: Record<string, string> = {
  inProgress: 'In Progress',
  ready: 'Ready',
  delivered: 'Delivered',
  late: 'Late',
};

function statusChipClass(statusKey: string): string {
  switch (statusKey) {
    case 'inProgress':
      return 'chip chip-progress';
    case 'ready':
      return 'chip chip-ready';
    case 'delivered':
      return 'chip chip-delivered';
    case 'late':
      return 'chip chip-late';
    default:
      return 'chip';
  }
}

/* ------------------------------------------------------------------ */
/*  Piece-type display (name_en stored, show as-is or lookup)          */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Status Update Dropdown (per-row)                                   */
/* ------------------------------------------------------------------ */
const NEXT_STATUS: Record<string, string[]> = {
  In_Progress: ['ready'],
  Ready: ['delivered'],
  Delivered: [],
  Late: ['ready'],
};

function StatusDropdown({
  current,
  orderId,
  orderBalance,
  onUpdated,
  t,
  currency,
}: {
  current: string;
  orderId: number;
  orderBalance: number;
  onUpdated: () => void;
  t: (key: string, params?: any) => string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const key = current === 'inProgress' ? 'In_Progress'
    : current === 'ready' ? 'Ready'
    : current === 'delivered' ? 'Delivered'
    : current === 'late' ? 'Late'
    : current;
  const next = NEXT_STATUS[key] || [];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useLayoutEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    } else {
      setPos(null);
    }
  }, [open]);

  async function handleSelect(dbStatus: string) {
    if (dbStatus === 'delivered' && orderBalance > 0.01) {
      setError(t('Cannot deliver: balance of {balance} QAR outstanding').replace('{balance}', orderBalance.toFixed(2)).replaceAll('QAR', t(currency)));
      setTimeout(() => setError(null), 4000);
      return;
    }
    try {
      await window.electronAPI.orders.updateStatus(orderId, dbStatus);
      setOpen(false);
      onUpdated();
    } catch (err: any) {
      setError(err?.message || t('Failed to update status'));
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${statusChipClass(current)} cursor-pointer`}
      >
        {t(STATUS_DISPLAY_LABELS[current] || current)}
        <span className="material-symbols-outlined text-xs ml-1 align-middle">expand_more</span>
      </button>
      {error && pos && createPortal(
        <div className="fixed z-[9999] bg-error text-on-primary text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap"
          style={{ top: pos.top, left: pos.left }}>
          {error}
        </div>,
        document.body,
      )}
      {open && next.length > 0 && pos && createPortal(
        <div className="fixed z-[9999] bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/30 py-1 min-w-[140px]"
          style={{ top: pos.top, left: pos.left }}>
          {next.map((s) => {
            const targetStatus = s === 'ready' ? 'ready' : 'delivered';
            const isBlocked = targetStatus === 'delivered' && orderBalance > 0.01;
            return (
              <button
                key={s}
                onClick={() => handleSelect(targetStatus)}
                disabled={isBlocked}
                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                  isBlocked
                    ? 'text-outline cursor-not-allowed'
                    : 'hover:bg-surface-container-high'
                }`}
                title={isBlocked ? t('Order must be fully paid before delivery') : undefined}
              >
                {t('Mark as')} {t(STATUS_DISPLAY_LABELS[targetStatus] || targetStatus)}
                {isBlocked && <span className="ml-1 text-error text-xs">({t('Unpaid')})</span>}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function OrdersPage() {
  const navigate = useNavigate();
  const { t, currency } = useTranslation();
  const session = JSON.parse(localStorage.getItem('session') || '{}');
  const isWorker = session.role === 'worker';
  const isAdmin = session.role === 'admin';
  const { activeBranchId } = useActiveBranch();
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [orderItemsMap, setOrderItemsMap] = React.useState<Record<number, any[]>>({});

  /* Edit modal state */
  const [editingOrder, setEditingOrder] = React.useState<any>(null);
  const [editForm, setEditForm] = React.useState<any>(null);
  const [editOriginalPrice, setEditOriginalPrice] = React.useState(0);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editBranches, setEditBranches] = React.useState<any[]>([]);

  const openEditModal = async (orderId: number) => {
    try {
      const [orderData, branches] = await Promise.all([
        window.electronAPI.orders.get(orderId),
        window.electronAPI.branches.getAll(),
      ]);
      setEditingOrder(orderData);
      setEditBranches(branches);
      setEditForm({
        customer_name: orderData.customer_name || '',
        customer_phone: orderData.customer_phone || '',
        piece_type: orderData.piece_type,
        status: orderData.status,
        price: orderData.price,
        paid: orderData.paid,
        payment_method: orderData.payment_method,
        delivery_date: orderData.delivery_date || '',
        receive_date: orderData.receive_date || '',
        details: orderData.details || '',
        branch_id: orderData.branch_id,
      });
      setEditOriginalPrice(Number(orderData.price));
    } catch (err) {
      console.error('Failed to load order for edit:', err);
    }
  };

  const handleEditSave = async () => {
    if (!editingOrder || !editForm) return;
    setEditSaving(true);
    try {
      // Update customer info if changed
      if (editForm.customer_name !== editingOrder.customer_name || editForm.customer_phone !== editingOrder.customer_phone) {
        await window.electronAPI.customers.update(editingOrder.customer_id, {
          name: editForm.customer_name,
          phone: editForm.customer_phone,
        });
      }
      await window.electronAPI.orders.update(editingOrder.id, {
        branch_id: editForm.branch_id,
        customer_id: editingOrder.customer_id,
        piece_type: editForm.piece_type,
        details: editForm.details,
        price: Number(editForm.price),
        payment_method: editForm.payment_method,
        status: editForm.status,
        delivery_date: editForm.delivery_date,
      });
      const newPrice = Number(editForm.price);
      if (newPrice !== editOriginalPrice) {
        const tasks = await window.electronAPI.orders.getTasks(editingOrder.id);
        const nonDoneTasks = (tasks || []).filter((t: any) => t.status !== 'done');
        if (nonDoneTasks.length > 0) {
          const recalc = window.confirm(
            t('Price changed from {oldPrice} QAR to {newPrice} QAR. This will recalculate wages for {count} task(s). Proceed?')
              .replace('{oldPrice}', editOriginalPrice.toFixed(2))
              .replace('{newPrice}', newPrice.toFixed(2))
              .replace('{count}', String(nonDoneTasks.length))
              .replaceAll('QAR', t(currency))
          );
          if (recalc) {
            await window.electronAPI.orders.recalculateTaskWages(editingOrder.id, newPrice);
          }
        }
      }
      setEditingOrder(null);
      setEditForm(null);
      await fetchData();
    } catch (err) {
      console.error('Failed to save order:', err);
    } finally {
      setEditSaving(false);
    }
  };

  const closeEditModal = () => {
    setEditingOrder(null);
    setEditForm(null);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Admins see all branches, workers see only their branch
      const branchId = isAdmin ? undefined : activeBranchId;
      const [allOrders, orderStats] = await Promise.all([
        window.electronAPI.orders.getAll(branchId),
        window.electronAPI.orders.getStats(branchId),
      ]);
      setOrders(allOrders);
      setStats(orderStats);

      // Fetch items for each order
      const itemsMap: Record<number, any[]> = {};
      await Promise.all(
        allOrders.map(async (order: any) => {
          try {
            const items = await window.electronAPI.orders.getItems(order.id);
            if (items && items.length > 0) {
              itemsMap[order.id] = items;
            }
          } catch { /* ignore per-order errors */ }
        })
      );
      setOrderItemsMap(itemsMap);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Search with debounce */
  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (!q.trim()) {
        fetchData();
        return;
      }
      searchTimeout.current = setTimeout(async () => {
        try {
          const results = await window.electronAPI.orders.search(q);
          setOrders(results);

          // Fetch items for search results
          const itemsMap: Record<number, any[]> = {};
          await Promise.all(
            results.map(async (order: any) => {
              try {
                const items = await window.electronAPI.orders.getItems(order.id);
                if (items && items.length > 0) {
                  itemsMap[order.id] = items;
                }
              } catch { /* ignore */ }
            })
          );
          setOrderItemsMap(itemsMap);
        } catch (err) {
          console.error('Search failed:', err);
        }
      }, 300);
    },
    [fetchData],
  );

  /* Filter by tab */
  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'ready_unpaid') return o.status === 'ready' && (o.price - o.paid) > 0.01;
    const statusKey = displayStatusKey(o);
    if (activeFilter === 'in_progress') return DB_STATUSES_FOR_PROGRESS.includes(o.status);
    if (activeFilter === 'late') return statusKey === 'late';
    return statusKey === activeFilter;
  });

  /* Count ready & unpaid */
  const readyUnpaidCount = orders.filter((o) => o.status === 'ready' && (o.price - o.paid) > 0.01).length;

  /* Stats badges */
  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: t('All'), count: stats?.total ?? 0 },
    { key: 'in_progress', label: t('In Progress'), count: stats?.in_progress ?? 0 },
    { key: 'ready', label: t('Ready'), count: stats?.ready ?? 0 },
    { key: 'ready_unpaid', label: t('Ready & Unpaid'), count: readyUnpaidCount },
    { key: 'delivered', label: t('Delivered'), count: stats?.delivered ?? 0 },
    { key: 'late', label: t('Late'), count: stats?.overdue ?? 0 },
  ];

  /* Helpers */
  function buildItemsSummary(items: any[] | undefined, fallback: string): string {
    if (!items || items.length === 0) return fallback;
    const totalQty = items.reduce((s, it) => s + (it.quantity || 1), 0);
    if (items.length === 1) {
      return `${items[0].piece_type} x${items[0].quantity || 1}`;
    }
    if (totalQty <= 6) {
      return items.map((it) => `${it.piece_type} x${it.quantity || 1}`).join(', ');
    }
    return `${items.length} types, ${totalQty} pieces`;
  }

  function formatCurrency(v: number) {
    return v.toLocaleString('en-US', { minimumFractionDigits: 0 });
  }

  function sendWhatsApp(order: Order) {
    const phone = order.customer_phone?.replace(/[^0-9]/g, '') || '';
    if (!phone) {
      alert(t('No phone number for this customer.'));
      return;
    }
    const balance = order.price - order.paid;
    const statusLabel = t(STATUS_DISPLAY_LABELS[displayStatusKey(order)] || order.status);
    const items = orderItemsMap[order.id]?.length > 0
      ? orderItemsMap[order.id].map((it: any) => `• ${it.piece_type} ×${it.quantity || 1}`).join('\n')
      : `• ${order.piece_type}`;
    const msg = `*Etiquette Tailor - Order Update*

*Order:* ${order.order_number}
*Customer:* ${order.customer_name}
*Status:* ${statusLabel}

*Items:*
${items}

*Price:* ${formatCurrency(order.price)} ${t(currency)}
*Paid:* ${formatCurrency(order.paid)} ${t(currency)}
${balance > 0.01 ? `*Balance Due:* ${formatCurrency(balance)} ${t(currency)}` : '*Fully Paid*'}
*Delivery:* ${order.delivery_date ? format(parseISO(order.delivery_date), 'MMM dd, yyyy') : '--'}

${order.details ? `*Notes:* ${order.details}` : ''}`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    window.electronAPI.shell.openExternal(url);
  }

  function getInitials(name?: string) {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <div className="space-y-8">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap justify-between items-end gap-4">
        <div>
          <h2 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-headline">
            {t('Orders Registry')}
          </h2>
          <p className="text-secondary text-lg">{t('Manage bespoke commissions and production status.')}</p>
        </div>

        {/* Filters cluster */}
        <div className="flex gap-3 items-center bg-surface-container-low p-2 rounded-xl">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]">
              search
            </span>
            <input
              type="text"
              placeholder={t('Search orders...')}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="h-10 pl-10 pr-4 bg-surface-container-lowest border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none w-52"
            />
          </div>

          {/* New Order */}
          <button
            onClick={() => navigate('/orders/new')}
            className="btn-primary h-10 px-5 text-sm rounded-lg flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t('New Order')}
          </button>
        </div>
      </div>

      {/* ---- Filter Tabs ---- */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeFilter === tab.key
                ? 'bg-primary text-on-primary shadow-sm'
                : tab.key === 'ready_unpaid' && tab.count > 0
                  ? 'bg-error/10 text-error hover:bg-error/20'
                  : 'bg-surface-container-high text-secondary hover:bg-surface-container-highest'
            }`}
          >
            {tab.label}
            <span
              className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                activeFilter === tab.key
                  ? 'bg-on-primary/20 text-on-primary'
                  : 'bg-surface-container-highest text-outline'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ---- Card Grid ---- */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
          {t('Loading orders...')}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-secondary">
          <span className="material-symbols-outlined text-4xl mb-3 text-outline">shopping_bag</span>
          <p className="font-semibold text-on-surface mb-1">{t('No orders found')}</p>
          <p className="text-sm">{t('Try adjusting your filters or create a new order.')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredOrders.map((order) => {
            const dStatus = displayStatusKey(order);
            const balance = order.price - order.paid;
            const itemsSummary = buildItemsSummary(orderItemsMap[order.id], order.piece_type);

            return (
              <div key={order.id} className="bg-surface-container-lowest rounded-2xl shadow-[0px_8px_24px_rgba(25,28,29,0.08)] overflow-hidden">
                {/* Top section: left info + right info */}
                <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
                  {/* Left: order number, tags, customer */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <button
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className="font-bold text-on-surface hover:text-primary cursor-pointer text-base font-headline"
                      >
                        {order.order_number}
                      </button>
                      {order.branch_name && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                          {order.branch_name}
                        </span>
                      )}
                      <StatusDropdown
                        current={dStatus}
                        orderId={order.id}
                        orderBalance={balance}
                        onUpdated={fetchData}
                        t={t}
                        currency={currency}
                      />
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface font-semibold">
                        {itemsSummary}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-on-surface">{order.customer_name || t('Unknown')}</p>
                    {order.customer_phone && (
                      <p className="text-xs text-secondary">{order.customer_phone}</p>
                    )}
                  </div>

                  {/* Right: piece type, price, pending */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-on-surface">{order.piece_type}</p>
                    {!isWorker && (
                      <>
                        <p className="text-base font-extrabold text-on-surface">{formatCurrency(order.price)} <span className="text-xs font-semibold text-secondary">{t(currency)}</span></p>
                        {balance > 0.01 ? (
                          <p className="text-xs font-bold text-orange-500">{t('Pending')}: {formatCurrency(balance)} {t(currency)}</p>
                        ) : (
                          <p className="text-xs font-bold text-tertiary flex items-center justify-end gap-0.5">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            {t('Paid')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom toolbar */}
                <div className="border-t border-outline-variant/20 px-3 py-2 flex items-center justify-between">
                  {/* Status dropdown area (left) */}
                  <div className="flex items-center gap-1 text-xs text-secondary">
                    <span className="material-symbols-outlined text-sm">event</span>
                    {order.delivery_date
                      ? format(parseISO(order.delivery_date), 'MMM dd, yyyy')
                      : '--'}
                  </div>

                  {/* Action icons (right) */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => openEditModal(order.id)}
                      className="p-2 hover:bg-surface-container-high rounded-lg text-secondary hover:text-primary transition-colors"
                      title={t('Edit')}
                    >
                      <span className="material-symbols-outlined text-lg">edit_square</span>
                    </button>
                    <button
                      onClick={() => navigate(`/orders/${order.id}`)}
                      className="p-2 hover:bg-surface-container-high rounded-lg text-secondary hover:text-primary transition-colors"
                      title={t('View')}
                    >
                      <span className="material-symbols-outlined text-lg">visibility</span>
                    </button>
                    <button
                      onClick={() => navigate(`/invoice/${order.id}`)}
                      className="p-2 hover:bg-surface-container-high rounded-lg text-secondary hover:text-primary transition-colors"
                      title={t('Print Invoice')}
                    >
                      <span className="material-symbols-outlined text-lg">print</span>
                    </button>
                    <button
                      onClick={() => sendWhatsApp(order)}
                      className="p-2 hover:bg-green-500/10 rounded-lg text-green-600 hover:text-green-700 transition-colors"
                      title={t('WhatsApp')}
                    >
                      <span className="material-symbols-outlined text-lg">chat</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('Delete order {number}? This cannot be undone.').replace('{number}', order.order_number))) {
                          window.electronAPI.orders.delete(order.id).then(fetchData);
                        }
                      }}
                      className="p-2 hover:bg-error/10 rounded-lg text-secondary hover:text-error transition-colors"
                      title={t('Delete')}
                    >
                      <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Footer info ---- */}
      {!loading && filteredOrders.length > 0 && (
        <div className="flex justify-between items-center text-secondary text-sm px-2">
          <div>
            {t('Showing {count} of {total} orders')}{' '}
            <span className="font-bold text-on-surface">{filteredOrders.length}</span> {t('of')}{' '}
            <span className="font-bold text-on-surface">{stats?.total ?? 0}</span> {t('order(s)')}
          </div>
          <div className="flex gap-2">
            {!isWorker && (
              <span className="text-xs text-outline">
                {t('Revenue (open):')}{' '}
                <span className="font-bold text-on-surface">
                  {(stats?.revenue ?? 0).toLocaleString('en-US')} {t(currency)}
                </span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ---- Edit Order Modal ---- */}
      {editingOrder && editForm && (
        <div className="modal-backdrop" onClick={closeEditModal}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-6">
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-xl font-headline font-bold">{t('Edit Order')}</h2>
                    <p className="text-sm text-secondary mt-0.5">{editingOrder.order_number}</p>
                  </div>
                  <button onClick={closeEditModal} className="p-1.5 hover:bg-surface-container-high rounded-md text-secondary">
                    <span className="material-symbols-outlined text-lg">close</span>
                  </button>
                </div>

                {/* Customer info */}
                <div className="mb-5 pb-4 border-b border-outline-variant/20">
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-secondary mb-3">{t('Customer')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Customer Name')}</label>
                      <input value={editForm.customer_name} onChange={(e) => setEditForm({...editForm, customer_name: e.target.value})} className="input-field w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Phone')}</label>
                      <input value={editForm.customer_phone} onChange={(e) => setEditForm({...editForm, customer_phone: e.target.value})} className="input-field w-full" />
                    </div>
                  </div>
                </div>

{/* Order fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Piece Type')}</label>
                    <input value={editForm.piece_type} onChange={(e) => setEditForm({...editForm, piece_type: e.target.value})} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Status')}</label>
                    <select value={editForm.status} onChange={(e) => setEditForm({...editForm, status: e.target.value})} className="input-field w-full appearance-none">
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
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Branch')}</label>
                    <select
                      value={editForm.branch_id}
                      onChange={(e) => setEditForm({...editForm, branch_id: Number(e.target.value)})}
                      className="input-field w-full appearance-none"
                    >
                      {editBranches.map((b: any) => (
                        <option key={b.id} value={b.id}>{b.name_en}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{`${t('Price')} (${t(currency)})`}</label>
                        <input type="number" value={editForm.price} onChange={(e) => setEditForm({...editForm, price: e.target.value})} className="input-field w-full" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Paid')}</label>
                        <input type="number" value={editForm.paid} readOnly className="input-field w-full bg-surface-container-high text-secondary cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Payment Method')}</label>
                        <select value={editForm.payment_method} onChange={(e) => setEditForm({...editForm, payment_method: e.target.value})} className="input-field w-full appearance-none">
                          <option value="cash">{t('Cash')}</option>
                          <option value="card">{t('Card')}</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Receive Date')}</label>
                    <input type="date" value={editForm.receive_date} onChange={(e) => setEditForm({...editForm, receive_date: e.target.value})} className="input-field w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Due Date')}</label>
                    <input type="date" value={editForm.delivery_date} onChange={(e) => setEditForm({...editForm, delivery_date: e.target.value})} className="input-field w-full" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-secondary mb-1">{t('Details')}</label>
                    <textarea value={editForm.details} onChange={(e) => setEditForm({...editForm, details: e.target.value})} className="input-field w-full min-h-[80px]" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={closeEditModal} className="px-4 py-2 text-sm text-secondary hover:bg-surface-container-high rounded-lg">{t('Cancel')}</button>
                  <button onClick={handleEditSave} disabled={editSaving} className="btn-primary px-6 py-2 text-sm disabled:opacity-50">
                    {editSaving ? t('Saving...') : t('Save')}
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
