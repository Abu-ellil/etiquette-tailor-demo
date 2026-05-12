import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isPast } from 'date-fns';
import { useTranslation } from '../contexts/I18nContext';
import { useActiveBranch } from '../contexts/BranchContext';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

interface OrderStats {
  total: number;
  in_progress: number;
  ready: number;
  delivered: number;
  overdue: number;
  revenue: number;
}

interface Order {
  id: number;
  order_number: string;
  customer_name?: string;
  piece_type: string;
  details?: string;
  status: string;
  delivery_date?: string;
  price: number;
  paid: number;
}

function getInitials(name?: string): string {
  if (!name) return '--';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
}

function getStatusChip(status: string, isLate: boolean, t: (key: string) => string) {
  if (isLate) {
    return <span className="chip chip-late">{t('Late')}</span>;
  }
  switch (status) {
    case 'ready':
      return <span className="chip chip-ready">{t('Ready')}</span>;
    case 'delivered':
      return <span className="chip chip-delivered">{t('Delivered')}</span>;
    default:
      return <span className="chip chip-progress">{t('In Progress')}</span>;
  }
}

function isOrderLate(order: Order): boolean {
  if (order.status === 'delivered') return false;
  if (!order.delivery_date) return false;
  try {
    return isPast(parseISO(order.delivery_date));
  } catch {
    return false;
  }
}

function formatRevenue(amount: number, currencyLabel: string): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k ${currencyLabel}`;
  }
  return `${amount.toFixed(0)} ${currencyLabel}`;
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '--';
  try {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

// Color rotation for avatar circles
const AVATAR_COLORS = [
  { bg: 'bg-primary-fixed', text: 'text-on-primary-fixed' },
  { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
  { bg: 'bg-error-container', text: 'text-on-error-container' },
  { bg: 'bg-secondary-container', text: 'text-on-secondary' },
  { bg: 'bg-tertiary-fixed', text: 'text-on-tertiary-fixed' },
  { bg: 'bg-surface-container-highest', text: 'text-on-surface-variant' },
];

function getAvatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t, currency } = useTranslation();
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workerTasks, setWorkerTasks] = useState<any[]>([]);
  const [allTasks, setAllTasks] = useState<any[]>([]);
  const [orderItemsMap, setOrderItemsMap] = useState<Record<number, any[]>>({});
  const [dailyChartData, setDailyChartData] = useState<any[]>([]);
  const [workerContributionData, setWorkerContributionData] = useState<any[]>([]);

  const session = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch {
      return {};
    }
  }, []);

  const { activeBranchId } = useActiveBranch();

  const isWorker = session.role === 'worker';
  const isTailor = isWorker && session.worker_type === 'tailor';
  const isCutter = isWorker && session.worker_type === 'master_cutter';
  const isManager = session.role === 'manager' || session.role === 'admin';

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        if (isWorker) {
          const tasks = await window.electronAPI.workers.getWorkerTasks(session.userId);
          setWorkerTasks(tasks || []);
        } else {
          try {
            await window.electronAPI.notifications.generateOverdue();
          } catch { /* non-critical */ }

          const branchFilter = isManager ? activeBranchId : undefined;
          const [statsData, ordersData] = await Promise.all([
            window.electronAPI.orders.getStats(branchFilter),
            window.electronAPI.orders.getAll(branchFilter),
          ]);
          setStats(statsData);
          const latestOrders = (ordersData || []).slice(0, 5);
          setOrders(latestOrders);

          // Fetch items for latest orders
          const itemsMap: Record<number, any[]> = {};
          await Promise.all(
            latestOrders.map(async (order: any) => {
              try {
                const items = await window.electronAPI.orders.getItems(order.id);
                if (items && items.length > 0) {
                  itemsMap[order.id] = items;
                }
              } catch { /* ignore */ }
            })
          );
          setOrderItemsMap(itemsMap);

          const tasks = await window.electronAPI.orders.getAllTasks(isManager ? { branchId: activeBranchId } : {});
          setAllTasks(tasks || []);

          try {
            const [dailyData, contributionData] = await Promise.all([
              window.electronAPI.reports.getDailyStats(14, branchFilter),
              window.electronAPI.reports.getWorkerContribution(branchFilter),
            ]);
            setDailyChartData(dailyData || []);
            setWorkerContributionData(contributionData || []);
          } catch { /* non-critical */ }
        }
      } catch (err: unknown) {
        console.error('Failed to load dashboard data:', err);
        const message = err instanceof Error ? err.message : t('Failed to load dashboard data. Please try again.');
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isWorker, isTailor, isCutter, session.userId]);

  if (loading) {
    return (
      <div className="space-y-12 pb-20">
        {/* Stats skeleton */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="bg-surface-container-lowest p-6 rounded-xl h-40 animate-pulse"
            >
              <div className="flex justify-between items-start">
                <div className="w-6 h-6 bg-surface-container-high rounded" />
                <div className="w-20 h-3 bg-surface-container-high rounded" />
              </div>
              <div className="mt-4">
                <div className="w-16 h-8 bg-surface-container-high rounded" />
                <div className="w-24 h-3 bg-surface-container-high rounded mt-2" />
              </div>
            </div>
          ))}
        </section>
        {/* Table skeleton */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-4">
            <div className="h-6 w-40 bg-surface-container-high rounded animate-pulse" />
            <div className="h-32 bg-surface-container-lowest rounded-lg animate-pulse" />
            <div className="h-32 bg-surface-container-lowest rounded-lg animate-pulse" />
          </div>
          <div className="lg:col-span-8">
            <div className="h-6 w-40 bg-surface-container-high rounded mb-8 animate-pulse" />
            <div className="h-64 bg-surface-container-lowest rounded-xl animate-pulse" />
          </div>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <span className="material-symbols-outlined text-5xl text-error">error</span>
        <p className="text-on-surface-variant text-sm">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary text-sm"
        >
          {t('Retry')}
        </button>
      </div>
    );
  }

  const safeStats = stats || { total: 0, in_progress: 0, ready: 0, delivered: 0, overdue: 0, revenue: 0 };

  if (isWorker) {
    return <WorkerDashboard tasks={workerTasks} isCutter={isCutter} loading={loading} />;
  }

  const taskCounts = {
    pending: allTasks.filter((t: any) => t.status === 'pending').length,
    in_progress: allTasks.filter((t: any) => t.status === 'in_progress').length,
    done: allTasks.filter((t: any) => t.status === 'done').length,
    unassigned: allTasks.filter((t: any) => !t.assigned_to).length,
  };

  return (
    <div className="space-y-12 pb-20">
      {/* New Order Button */}
      <div className="flex justify-end">
        <button
          onClick={() => navigate('/orders/new')}
          className="btn-primary px-6 py-3 text-sm tracking-wide flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">add_circle</span>
          <span className="whitespace-nowrap">{t('New Order')}</span>
        </button>
      </div>
      {/* Stats Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {/* Total Orders */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-primary/10 flex flex-col justify-between h-40 group hover:bg-primary-container transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-primary group-hover:text-white transition-colors">
              assignment
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary group-hover:text-white/60 transition-colors">
              {t('Total Orders')}
            </span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-headline font-extrabold text-on-surface group-hover:text-white transition-colors">
              {formatNumber(safeStats.total)}
            </span>
            <p className="text-xs text-secondary group-hover:text-white/80 transition-colors mt-1">
              {t('All time orders')}
            </p>
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-primary-fixed/50 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span
              className="material-symbols-outlined text-on-primary-fixed-variant"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              watch_later
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              {t('In Progress')}
            </span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-headline font-extrabold text-on-surface">
              {formatNumber(safeStats.in_progress)}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-primary-fixed" />
              <p className="text-xs text-secondary">{t('Active on floor')}</p>
            </div>
          </div>
        </div>

        {/* Ready */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-tertiary-fixed/50 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span
              className="material-symbols-outlined text-on-tertiary-fixed-variant"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              {t('Ready')}
            </span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-headline font-extrabold text-on-surface">
              {formatNumber(safeStats.ready)}
            </span>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-tertiary-fixed" />
              <p className="text-xs text-secondary">{t('Awaiting pickup')}</p>
            </div>
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-secondary/10 flex flex-col justify-between h-40">
          <div className="flex justify-between items-start">
            <span
              className="material-symbols-outlined text-secondary"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              local_shipping
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
              {t('Delivered')}
            </span>
          </div>
          <div className="mt-4">
            <span className="text-4xl font-headline font-extrabold text-on-surface">
              {formatNumber(safeStats.delivered)}
            </span>
            <p className="text-xs text-secondary mt-1">{t('Total fulfilled')}</p>
          </div>
        </div>

        {/* Revenue */}
        {!isManager && (
          <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-primary/20 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                payments
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                {t('Revenue')}
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-headline font-extrabold text-on-surface">
                {formatRevenue(safeStats.revenue, t(currency))}
              </span>
              <p className="text-xs text-secondary mt-1">{t('Open order value')}</p>
            </div>
          </div>
        )}
        {isManager && (
          <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-primary/20 flex flex-col justify-between h-40">
            <div className="flex justify-between items-start">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                task_alt
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
                {t('Tasks Done')}
              </span>
            </div>
            <div className="mt-4">
              <span className="text-4xl font-headline font-extrabold text-on-surface">
                {formatNumber(taskCounts.done)}
              </span>
              <p className="text-xs text-secondary mt-1">{t('Completed tasks')}</p>
            </div>
          </div>
        )}
      </section>

      {/* Production Summary (Admin/Manager) */}
      {allTasks.length > 0 && (
        <section className="bg-surface-container-lowest rounded-xl p-8">
          <h3 className="text-xl font-headline font-bold text-on-surface mb-6">{t('Production Summary')}</h3>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-surface rounded-lg p-5 text-center">
              <span className="text-3xl font-headline font-bold text-on-surface">{taskCounts.pending}</span>
              <p className="text-xs text-secondary mt-1 uppercase font-bold tracking-wider">{t('Pending')}</p>
            </div>
            <div className="bg-primary-fixed rounded-lg p-5 text-center">
              <span className="text-3xl font-headline font-bold text-on-primary-fixed">{taskCounts.in_progress}</span>
              <p className="text-xs text-on-primary-fixed-variant mt-1 uppercase font-bold tracking-wider">{t('In Progress')}</p>
            </div>
            <div className="bg-tertiary-fixed rounded-lg p-5 text-center">
              <span className="text-3xl font-headline font-bold text-on-tertiary-fixed">{taskCounts.done}</span>
              <p className="text-xs text-on-tertiary-fixed-variant mt-1 uppercase font-bold tracking-wider">{t('Done')}</p>
            </div>
          </div>
        </section>
      )}

      {/* Dashboard Charts */}
      {!isManager && (dailyChartData.length > 0 || workerContributionData.length > 0) && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {dailyChartData.length > 0 && (
            <div className={workerContributionData.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'}>
              <div className="bg-surface-container-lowest rounded-xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-headline font-bold text-on-surface">{t('Orders Over Time')}</h3>
                  <span className="text-xs font-bold text-tertiary bg-tertiary-fixed px-3 py-1 rounded-full uppercase">{t('Last 14 Days')}</span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyChartData}>
                    <defs>
                      <linearGradient id="dashOrdersGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#763952" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#763952" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e7e8e9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#807381" tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} stroke="#807381" />
                    <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Area type="monotone" dataKey="orders" stroke="#763952" fill="url(#dashOrdersGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {workerContributionData.length > 0 && (
            <div className={dailyChartData.length > 0 ? 'lg:col-span-4' : 'lg:col-span-12'}>
              <div className="bg-surface-container-lowest rounded-xl p-6">
                <h3 className="text-xl font-headline font-bold text-on-surface mb-6">{t('Worker Contribution')}</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={workerContributionData} dataKey="task_count" nameKey="worker_name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} paddingAngle={2}>
                      {workerContributionData.map((_e: any, i: number) => (
                        <Cell key={i} fill={['#763952', '#505f76', '#695f00', '#d0e1fb', '#f2e57b', '#ffd9e4'][i % 6]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Alerts & Latest Orders */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Alerts Section */}
        <div className="lg:col-span-4 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-headline font-bold text-on-surface">
              {t('Critical Alerts')}
            </h3>
            {safeStats.overdue > 0 && (
              <span className="px-2 py-1 bg-error-container text-on-error-container text-[10px] font-bold rounded uppercase">
                {t('Action Required')}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Late Orders Alert */}
            <div
              className={`p-5 rounded-lg border-l-4 flex gap-4 ${
                safeStats.overdue > 0
                  ? 'bg-error-container/30 border-error'
                  : 'bg-surface-container-low border-outline-variant'
              }`}
            >
              <span
                className={`material-symbols-outlined ${
                  safeStats.overdue > 0 ? 'text-error' : 'text-on-surface-variant'
                }`}
              >
                warning
              </span>
              <div>
                <h4 className="font-bold text-on-error-container text-sm">
                  {safeStats.overdue > 0
                    ? `${safeStats.overdue} ${t('Late Orders')}`
                    : t('No Late Orders')}
                </h4>
                <p className="text-xs text-on-error-container/80 mt-1">
                  {safeStats.overdue > 0
                    ? t('Overdue delivery dates. Immediate attention required.')
                    : t('All orders are on schedule.')}
                </p>
              </div>
            </div>

            {/* Ready for Pickup Alert */}
            <div
              className={`p-5 rounded-lg border-l-4 flex gap-4 ${
                safeStats.ready > 0
                  ? 'bg-tertiary-fixed/30 border-tertiary'
                  : 'bg-surface-container-low border-outline-variant'
              }`}
            >
              <span
                className={`material-symbols-outlined ${
                  safeStats.ready > 0 ? 'text-tertiary' : 'text-on-surface-variant'
                }`}
              >
                notifications_active
              </span>
              <div>
                <h4 className="font-bold text-on-tertiary-container text-sm">
                  {safeStats.ready > 0
                    ? `${safeStats.ready} ${t('Ready for Pickup')}`
                    : t('No Ready Orders')}
                </h4>
                <p className="text-xs text-on-tertiary-container/80 mt-1">
                  {safeStats.ready > 0
                    ? t('Orders awaiting customer collection.')
                    : t('All ready orders have been picked up.')}
                </p>
              </div>
            </div>

            {/* Unassigned Tasks Alert */}
            <div
              className={`p-5 rounded-lg border-l-4 flex gap-4 cursor-pointer transition-all hover:shadow-md ${
                taskCounts.unassigned > 0
                  ? 'bg-primary-container/20 border-primary hover:bg-primary-container/30'
                  : 'bg-surface-container-low border-outline-variant'
              }`}
              onClick={() => { if (taskCounts.unassigned > 0) window.location.hash = '#/task-board'; }}
            >
              <span
                className={`material-symbols-outlined ${
                  taskCounts.unassigned > 0 ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                person_add
              </span>
              <div>
                <h4 className="font-bold text-sm text-on-surface">
                  {taskCounts.unassigned > 0
                    ? `${taskCounts.unassigned} ${t('Unassigned Tasks')}`
                    : t('All Tasks Assigned')}
                </h4>
                <p className="text-xs text-secondary mt-1">
                  {taskCounts.unassigned > 0
                    ? t('Click to assign workers from Task Board.')
                    : t('All tasks have workers assigned.')}
                </p>
              </div>
            </div>

            {/* Studio Insights Card */}
            <div className="bg-surface-container-low p-6 rounded-xl flex flex-col items-center justify-center text-center space-y-3 h-48">
              <span className="material-symbols-outlined text-4xl text-primary">
                insights
              </span>
              <h4 className="font-headline font-bold text-on-surface">
                {t('Workshop Summary')}
              </h4>
              <p className="text-xs text-secondary max-w-[200px]">
                {safeStats.total > 0
                  ? `${formatNumber(safeStats.in_progress)} ${t('In Progress').toLowerCase()}, ${formatNumber(safeStats.ready)} ${t('Ready').toLowerCase()}, ${formatNumber(safeStats.delivered)} ${t('Delivered').toLowerCase()}.`
                  : `${t('No Orders Yet')}. ${t('Orders will appear here once created. Use the "New Order" button to get started.')}`}
              </p>
            </div>
          </div>
        </div>

        {/* Latest Orders Table */}
        <div className="lg:col-span-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-headline font-bold text-on-surface">
              {t('Latest Orders')}
            </h3>
          </div>

          {orders.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-3">
              <span className="material-symbols-outlined text-5xl text-on-surface-variant">
                inbox
              </span>
              <h4 className="font-headline font-bold text-on-surface-variant">
                {t('No Orders Yet')}
              </h4>
              <p className="text-xs text-secondary max-w-[260px]">
                {t('Orders will appear here once created. Use the "New Order" button to get started.')}
              </p>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Order ID')}</th>
                    <th>{t('Customer')}</th>
                    <th>{t('Item')}</th>
                    <th>{t('Status')}</th>
                    <th>{t('Delivery')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const late = isOrderLate(order);
                    const avatarColor = getAvatarColor(index);
                    return (
                      <tr key={order.id}>
                        <td className="text-sm font-mono font-bold text-primary">
                          {order.order_number}
                        </td>
                        <td>
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-full ${avatarColor.bg} flex items-center justify-center text-[10px] font-bold ${avatarColor.text}`}
                            >
                              {getInitials(order.customer_name)}
                            </div>
                            <span className="text-sm font-semibold text-on-surface truncate">
                              {order.customer_name || t('Unknown')}
                            </span>
                          </div>
                        </td>
                        <td className="text-sm text-secondary">
                          {buildItemsSummary(orderItemsMap[order.id], order.piece_type)}
                        </td>
                        <td>{getStatusChip(order.status, late, t)}</td>
                        <td
                          className={`text-sm ${
                            late ? 'text-error font-medium' : 'text-secondary'
                          }`}
                        >
                          {formatDate(order.delivery_date)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function WorkerDashboard({ tasks, isCutter, loading }: { tasks: any[]; isCutter: boolean; loading: boolean }) {
  const { t, currency } = useTranslation();
  const session = React.useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('session') || '{}');
    } catch {
      return {};
    }
  }, []);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [earnings, setEarnings] = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [branchName, setBranchName] = useState<string>('--');

  // Load earnings for selected month
  React.useEffect(() => {
    async function load() {
      if (!session.userId) return;
      try {
        const data = await window.electronAPI.workers.getMonthlyEarnings(session.userId, selectedMonth);
        setEarnings(data);
      } catch {
        setEarnings({ task_count: 0, piece_earnings: 0, fixed_salary: 0, total_earnings: 0 });
      }
    }
    load();
  }, [session.userId, selectedMonth]);

  // Load account info (all-time)
  React.useEffect(() => {
    async function load() {
      if (!session.userId) return;
      try {
        const data = await window.electronAPI.workers.getAccount(session.userId);
        setAccount(data);
      } catch {
        setAccount({ total_earnings: 0, total_paid: 0, balance: 0, task_count: 0 });
      }
    }
    load();
  }, [session.userId]);

  // Load branch name
  React.useEffect(() => {
    async function load() {
      if (!activeBranchId) return;
      try {
        const branch = await window.electronAPI.branches.getById(activeBranchId);
        if (branch) setBranchName(branch.name_en || branch.name_ar || '--');
      } catch {}
    }
    load();
  }, [activeBranchId]);

  const filtered = isCutter
    ? tasks.filter((t) => t.task_type === 'cutting')
    : tasks;

  const pendingCount = filtered.filter((t) => t.status === 'pending').length;
  const inProgressCount = filtered.filter((t) => t.status === 'in_progress').length;
  const doneToday = filtered.filter((t) => {
    if (t.status !== 'done' || !t.completed_at) return false;
    return new Date(t.completed_at).toDateString() === new Date().toDateString();
  }).length;

  const workerTypeLabel = session.worker_type === 'master_cutter' ? t('Master Cutter') : t('Tailor');

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-surface-container-lowest p-8 rounded-xl h-40 animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface-container-lowest p-6 rounded-xl h-32 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profile Card */}
      <div className="bg-surface-container-lowest p-8 rounded-xl flex items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold text-xl shrink-0">
          {getInitials(session.name)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-headline font-extrabold text-on-surface truncate">{session.name}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-secondary">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">{isCutter ? 'content_cut' : 'styler'}</span>
              {workerTypeLabel}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">store</span>
              {branchName}
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-base">payments</span>
              {(earnings?.fixed_salary || 0).toLocaleString()} {t(currency)} {t('base')}
            </span>
          </div>
        </div>
      </div>

      {/* Account Summary - All Time */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-primary/20 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('Total Profit')}</span>
          <div>
            <span className="text-3xl font-headline font-extrabold text-on-surface">{(account?.total_earnings || 0).toLocaleString()}</span>
            <span className="text-sm text-secondary ml-1">{t(currency)}</span>
          </div>
          <p className="text-xs text-secondary">{account?.task_count || 0} {t('completed tasks')}</p>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-secondary/20 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('Total Paid')}</span>
          <div>
            <span className="text-3xl font-headline font-extrabold text-on-surface">{(account?.total_paid || 0).toLocaleString()}</span>
            <span className="text-sm text-secondary ml-1">{t(currency)}</span>
          </div>
          <p className="text-xs text-secondary">{t('Payments received')}</p>
        </div>
        {(() => {
          const hasBalance = (account?.balance || 0) > 0;
          return (
            <div className={`p-6 rounded-xl flex flex-col justify-between h-32 ${
              hasBalance ? 'bg-tertiary-fixed' : 'bg-surface-container-lowest border-b-2 border-outline-variant/20'
            }`}>
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                hasBalance ? 'text-on-tertiary-fixed-variant' : 'text-secondary'
              }`}>{t('Account Balance')}</span>
              <div>
                <span className={`text-3xl font-headline font-extrabold ${
                  hasBalance ? 'text-on-tertiary-fixed' : 'text-on-surface'
                }`}>{(account?.balance || 0).toLocaleString()}</span>
                <span className={`text-sm ml-1 ${
                  hasBalance ? 'text-on-tertiary-fixed-variant' : 'text-secondary'
                }`}>{t(currency)}</span>
              </div>
              <p className="text-xs text-on-tertiary-fixed-variant">{t('Amount owed to you')}</p>
            </div>
          );
        })()}
      </div>

      {/* Task Stats */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-primary/20 flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">{t('Pending')}</span>
          <span className="text-4xl font-headline font-extrabold text-on-surface">{pendingCount}</span>
        </div>
        <div className="bg-primary-fixed p-6 rounded-xl flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-primary-fixed-variant">{t('In Progress')}</span>
          <span className="text-4xl font-headline font-extrabold text-on-primary-fixed">{inProgressCount}</span>
        </div>
        <div className="bg-tertiary-fixed p-6 rounded-xl flex flex-col justify-between h-32">
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-tertiary-fixed-variant">{t('Done Today')}</span>
          <span className="text-4xl font-headline font-extrabold text-on-tertiary-fixed">{doneToday}</span>
        </div>
      </div>

      {/* Earnings + Task List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Monthly Earnings */}
        <div className="lg:col-span-4">
          <div className="bg-surface-container-lowest rounded-xl p-6 space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-headline font-bold text-on-surface">{t('Earnings')}</h3>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-surface-container-high text-xs px-2 py-1 rounded border-none outline-none cursor-pointer"
              />
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('Piece Earnings')}</span>
                <span className="font-semibold">{(earnings?.piece_earnings || 0).toLocaleString()} {t(currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-secondary">{t('Base Salary')}</span>
                <span className="font-semibold">{(earnings?.fixed_salary || 0).toLocaleString()} {t(currency)}</span>
              </div>
              <div className="h-px bg-outline-variant/20" />
              <div className="flex justify-between">
                <span className="font-bold">{t('Total')}</span>
                <span className="font-bold text-primary text-lg">{(earnings?.total_earnings || 0).toLocaleString()} {t(currency)}</span>
              </div>
            </div>
            <p className="text-xs text-secondary">{earnings?.task_count || 0} {t('completed tasks')}</p>
          </div>
        </div>

        {/* Task List */}
        <div className="lg:col-span-8">
          <h3 className="text-lg font-headline font-bold text-on-surface mb-4">
            {isCutter ? t('Cutting Queue') : t('My Tasks')}
          </h3>
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-secondary">
                <span className="material-symbols-outlined text-5xl mb-3 text-outline">{isCutter ? 'content_cut' : 'checklist'}</span>
                <p className="font-semibold text-on-surface">{t('No tasks assigned')}</p>
                <p className="text-sm mt-1">{t('Tasks will appear here when assigned to you.')}</p>
              </div>
            ) : (
              filtered
                .sort((a, b) => {
                  const order: Record<string, number> = { in_progress: 0, pending: 1, done: 2 };
                  return (order[a.status] ?? 3) - (order[b.status] ?? 3);
                })
                .map((task) => (
                  <div key={task.task_id} className="bg-surface-container-lowest rounded-xl p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                        task.status === 'done' ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                        : task.status === 'in_progress' ? 'bg-primary-fixed text-on-primary-fixed'
                        : 'bg-surface-container-high text-on-surface-variant'
                      }`}>
                        {task.status === 'in_progress' ? t('In Progress') : task.status === 'done' ? t('Done') : t('Pending')}
                      </span>
                      <div className="min-w-0 flex items-center gap-2">
                        <a
                          href={`#/orders/${task.order_id}`}
                          className="font-bold text-primary hover:underline whitespace-nowrap"
                        >
                          {task.order_number}
                        </a>
                        <span className="text-secondary">·</span>
                        <span className="text-sm text-secondary truncate">{task.piece_type}</span>
                        {task.task_quantity && task.task_quantity > 1 && (
                          <span className="text-xs text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">x{task.task_quantity}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-secondary whitespace-nowrap shrink-0">
                      {task.due_date ? `${t('Due:')} ${formatDate(task.due_date)}` : ''}
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
