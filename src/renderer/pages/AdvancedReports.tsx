import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from '../contexts/I18nContext';
import { useActiveBranch } from '../contexts/BranchContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WorkerPerformance {
  worker_id: number;
  worker_name: string;
  order_count: number;
  percentage: number;
  revenue: number;
}

interface ReportOrder {
  id: number;
  order_number: string;
  customer_name?: string;
  piece_type: string;
  status: string;
  price: number;
  paid: number;
  branch_id?: number;
  created_at?: string;
  delivery_date?: string;
}

interface DailyStat {
  date: string;
  orders: number;
  revenue: number;
}

interface WorkerContribution {
  worker_name: string;
  task_count: number;
  wage_total: number;
}

interface ReportData {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  completedOrders: number;
  workerPerformance: WorkerPerformance[];
  orders: ReportOrder[];
}

interface BranchInfo {
  id: number;
  name_en: string;
  name_ar: string;
  prefix: string;
}

const PIE_COLORS = ['#763952', '#505f76', '#695f00', '#d0e1fb', '#f2e57b', '#ffd9e4', '#ba1a1a', '#92506a'];
const STATUS_COLORS: Record<string, string> = {
  intake: '#505f76', cutting: '#695f00', sewing: '#763952', ready: '#d0e1fb', delivered: '#4a7c59',
};

type QuickDate = 'today' | 'week' | 'month' | 'year' | 'custom';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdvancedReportsPage() {
  const { t, currency } = useTranslation();
  const { branches } = useActiveBranch();

  const session = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('session') || '{}'); }
    catch { return {}; }
  }, []);

  const isAdmin = session.role === 'admin' || session.role === 'manager';

  /* ── Branch filter ── */
  const [selectedBranch, setSelectedBranch] = useState<number | undefined>(undefined);

  /* ── Date range ── */
  const [quickDate, setQuickDate] = useState<QuickDate>('month');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  /* ── Other filters ── */
  const [filterWorker, setFilterWorker] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  /* ── Data ── */
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
  const [workerContribution, setWorkerContribution] = useState<WorkerContribution[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);

  /* ── Email ── */
  const [emailTo, setEmailTo] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [savedEmails, setSavedEmails] = useState<{ id: number; email: string; label: string | null }[]>([]);

  /* ── Helpers ── */
  function formatCurrency(amount: number): string {
    return `${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ${t(currency)}`;
  }

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      intake: t('Intake'), cutting: t('Cutting'), sewing: t('Sewing'),
      ready: t('Ready'), delivered: t('Delivered'),
    };
    return map[status] || status;
  };

  const statusChipClass = (status: string) => {
    if (status === 'ready') return 'chip-ready';
    if (status === 'delivered') return 'chip-delivered';
    return 'chip-progress';
  };

  function applyQuickDate(qd: QuickDate) {
    setQuickDate(qd);
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().split('T')[0];
    switch (qd) {
      case 'today':
        setStartDate(fmt(today)); setEndDate(fmt(today)); break;
      case 'week': {
        const start = new Date(today);
        start.setDate(today.getDate() - today.getDay());
        setStartDate(fmt(start)); setEndDate(fmt(today)); break;
      }
      case 'month': {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        setStartDate(fmt(start)); setEndDate(fmt(today)); break;
      }
      case 'year': {
        const start = new Date(today.getFullYear(), 0, 1);
        setStartDate(fmt(start)); setEndDate(fmt(today)); break;
      }
    }
  }

  /* ── Load workers & emails ── */
  useEffect(() => {
    window.electronAPI.workers.getAll().then((d: any[]) => setWorkers(d || [])).catch(() => {});
  }, []);

  useEffect(() => {
    window.electronAPI.reports.getEmails().then((d: any[]) => setSavedEmails(d || [])).catch(() => {});
  }, [showEmailModal]);

  /* ── Load report data ── */
  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      const filter: any = {};
      if (!isAdmin) filter.branchId = session.branch_id;
      else if (selectedBranch) filter.branchId = selectedBranch;

      if (startDate) filter.startDate = startDate;
      if (endDate) filter.endDate = endDate;
      if (filterWorker) filter.workerId = parseInt(filterWorker);
      if (filterStatus) filter.status = filterStatus;

      const apiBranchId = !isAdmin ? session.branch_id : selectedBranch;

      const [data, daily, contribution] = await Promise.all([
        window.electronAPI.reports.getAdvanced(filter),
        window.electronAPI.reports.getDailyStats(30, apiBranchId),
        window.electronAPI.reports.getWorkerContribution(apiBranchId, filter.startDate, filter.endDate),
      ]);

      setReportData(data);
      setDailyStats(daily || []);
      setWorkerContribution(contribution || []);
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filterWorker, filterStatus, selectedBranch, isAdmin, session.branch_id]);

  useEffect(() => { loadReport(); }, [loadReport]);

  /* ── Computed values ── */
  const safeData = reportData || { totalOrders: 0, totalRevenue: 0, pendingOrders: 0, completedOrders: 0, workerPerformance: [], orders: [] };
  const balanceDue = safeData.orders.reduce((sum, o) => sum + (o.price - o.paid), 0);
  const avgOrderValue = safeData.totalOrders > 0 ? safeData.totalRevenue / safeData.totalOrders : 0;

  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    safeData.orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1; });
    return Object.entries(counts).map(([status, count]) => ({ name: statusLabel(status), value: count, status }));
  }, [safeData.orders]);

  const branchPrefix = (branchId: number) => branches.find((b: BranchInfo) => b.id === branchId)?.prefix || '--';

  /* ── PDF & Email ── */
  function buildPDFHtml(): string {
    if (!reportData) return '';
    const branchLabel = selectedBranch
      ? branches.find((b: BranchInfo) => b.id === selectedBranch)?.name_en || ''
      : t('All Branches');
    const rows = reportData.orders.map(o => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${o.order_number}</td>
        <td style="padding:8px;border:1px solid #ddd">${o.customer_name || '--'}</td>
        <td style="padding:8px;border:1px solid #ddd">${o.piece_type}</td>
        <td style="padding:8px;border:1px solid #ddd">${statusLabel(o.status)}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(o.price)}</td>
      </tr>
    `).join('');
    const workerRows = reportData.workerPerformance.map(w => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd">${w.worker_name}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${w.order_count}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${w.percentage}%</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right">${formatCurrency(w.revenue)}</td>
      </tr>
    `).join('');
    return `<html dir="${document.documentElement.dir}"><head><meta charset="utf-8"><title>Report</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;color:#333}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#763952;color:#fff;padding:8px;text-align:left;border:1px solid #ddd}h1{color:#763952}.summary{display:flex;gap:16px;margin:16px 0}.card{flex:1;background:#f8f9fa;padding:16px;border-radius:8px}.card h4{margin:0 0 4px;color:#505f76;font-size:12px;text-transform:uppercase}.card p{margin:0;font-size:24px;font-weight:bold;color:#191c1d}</style></head>
    <body>
    <h1>${t('Advanced Report')}</h1>
    <p>${t('Branch')}: ${branchLabel} | ${t('Period')}: ${startDate} → ${endDate}</p>
    <div class="summary">
      <div class="card"><h4>${t('Total Orders')}</h4><p>${reportData.totalOrders}</p></div>
      <div class="card"><h4>${t('Revenue')}</h4><p>${formatCurrency(reportData.totalRevenue)}</p></div>
      <div class="card"><h4>${t('Balance Due')}</h4><p>${formatCurrency(balanceDue)}</p></div>
      <div class="card"><h4>${t('Avg Order Value')}</h4><p>${formatCurrency(avgOrderValue)}</p></div>
    </div>
    <h3>${t('Worker Performance')}</h3>
    <table><thead><tr><th>${t('Worker')}</th><th style="text-align:center">${t('Orders')}</th><th style="text-align:center">%</th><th style="text-align:right">${t('Revenue')}</th></tr></thead><tbody>${workerRows}</tbody></table>
    <h3>${t('Orders')}</h3>
    <table><thead><tr><th>${t('Order')}</th><th>${t('Customer')}</th><th>${t('Service')}</th><th>${t('Status')}</th><th style="text-align:right">${t('Value')}</th></tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
  }

  async function handleExportPDF() {
    const html = buildPDFHtml();
    const filename = `report-${startDate}-${endDate}.pdf`;
    await window.electronAPI.reports.exportPDF(html, filename);
  }

  async function handleSendEmail() {
    if (!reportData || !emailTo) return;
    setEmailError('');
    try { await window.electronAPI.reports.saveEmail(emailTo); } catch { /* ignore */ }
    const subject = `${t('Report')} ${startDate} - ${endDate}`;
    const body = [
      `${t('Total Orders')}: ${reportData.totalOrders}`,
      `${t('Revenue')}: ${formatCurrency(reportData.totalRevenue)}`,
      `${t('Balance Due')}: ${formatCurrency(balanceDue)}`,
      `${t('Completed')}: ${reportData.completedOrders}`,
      '',
      t('Worker Performance') + ':',
      ...reportData.workerPerformance.map(w => `  ${w.worker_name}: ${w.order_count} ${t('orders')} (${w.percentage}%)`),
    ].join('\n');
    const html = buildPDFHtml();
    const filename = `report-${startDate}-${endDate}.pdf`;
    try {
      const result = await window.electronAPI.reports.sendEmail(emailTo, subject, body, html, filename);
      if (result.method === 'mailto') setEmailError('smtp');
      setEmailSent(true);
      setTimeout(() => { setEmailSent(false); setEmailError(''); setShowEmailModal(false); }, 2000);
    } catch (err: any) { setEmailError(err?.message || 'Failed to send email'); }
  }

  /* ── Loading skeleton ── */
  if (loading && !reportData) {
    return (
      <div className="pb-12">
        <header className="mb-8">
          <div className="h-10 w-80 bg-surface-container-high rounded animate-pulse mb-3" />
          <div className="h-5 w-60 bg-surface-container-high rounded animate-pulse" />
        </header>
        <div className="flex gap-2 mb-6">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 w-24 bg-surface-container-high rounded-full animate-pulse" />)}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-surface-container-lowest p-5 rounded-xl h-28 animate-pulse" />)}
        </div>
      </div>
    );
  }

  /* ── QUICK DATE OPTIONS ── */
  const QUICK_DATES: { key: QuickDate; label: string }[] = [
    { key: 'today', label: t('Today') },
    { key: 'week', label: t('This Week') },
    { key: 'month', label: t('This Month') },
    { key: 'year', label: t('This Year') },
    { key: 'custom', label: t('Custom') },
  ];

  /* ── KPI CARDS ── */
  const KPIS = [
    { label: t('Total Revenue'), value: formatCurrency(safeData.totalRevenue), icon: 'payments', color: 'bg-primary' },
    { label: t('Total Orders'), value: safeData.totalOrders.toLocaleString(), icon: 'shopping_cart', color: 'bg-secondary-container' },
    { label: t('Balance Due'), value: formatCurrency(balanceDue), icon: 'account_balance_wallet', color: 'bg-tertiary-container' },
    { label: t('Avg Order Value'), value: formatCurrency(avgOrderValue), icon: 'trending_up', color: 'bg-primary-fixed' },
  ];

  return (
    <div className="pb-12">
      {/* ── Header ── */}
      <header className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div>
          <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight mb-1">
            {t('Reports')}
          </h2>
          <p className="text-secondary text-sm">
            {t('Revenue, orders, workers, and branch performance.')}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl font-headline font-bold text-sm hover:opacity-90">
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            {t('Export PDF')}
          </button>
          <button onClick={() => setShowEmailModal(true)} className="flex items-center gap-2 px-4 py-2 bg-surface-container-low text-on-surface rounded-xl font-headline font-bold text-sm border border-outline-variant hover:bg-surface-container">
            <span className="material-symbols-outlined text-base">mail</span>
            {t('Email')}
          </button>
        </div>
      </header>

      {/* ── Branch Selector (admin only) ── */}
      {isAdmin && (
        <div className="flex items-center gap-2 mb-5">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">store</span>
          <div className="flex gap-1 bg-surface-container-lowest rounded-xl p-1">
            <button
              onClick={() => setSelectedBranch(undefined)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${!selectedBranch ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface'}`}
            >
              {t('All Branches')}
            </button>
            {branches.map((b: BranchInfo) => (
              <button
                key={b.id}
                onClick={() => setSelectedBranch(b.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedBranch === b.id ? 'bg-primary text-on-primary shadow-sm' : 'text-secondary hover:text-on-surface'}`}
              >
                {b.prefix} — {b.name_en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Date Pills ── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {QUICK_DATES.map(qd => (
          <button
            key={qd.key}
            onClick={() => applyQuickDate(qd.key)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
              quickDate === qd.key
                ? 'bg-surface-container-lowest text-on-surface shadow-sm border border-outline-variant'
                : 'text-secondary hover:text-on-surface'
            }`}
          >
            {qd.label}
          </button>
        ))}
      </div>

      {/* ── Custom Date Range + Filters ── */}
      <div className="bg-surface-container-lowest rounded-xl p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          {quickDate === 'custom' && (
            <>
              <div className="min-w-[130px]">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">{t('From')}</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="min-w-[130px]">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">{t('To')}</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20" />
              </div>
            </>
          )}
          <div className="min-w-[150px]">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">{t('Worker')}</label>
            <select value={filterWorker} onChange={e => setFilterWorker(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20">
              <option value="">{t('All Workers')}</option>
              {workers.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div className="min-w-[130px]">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">{t('Status')}</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20">
              <option value="">{t('All')}</option>
              <option value="intake">{t('Intake')}</option>
              <option value="cutting">{t('Cutting')}</option>
              <option value="sewing">{t('Sewing')}</option>
              <option value="ready">{t('Ready')}</option>
              <option value="delivered">{t('Delivered')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {KPIS.map(kpi => (
          <div key={kpi.label} className="bg-surface-container-lowest p-5 rounded-xl hover:translate-y-[-1px] transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 flex items-center justify-center rounded-lg ${kpi.color} text-white`}>
                <span className="material-symbols-outlined text-base">{kpi.icon}</span>
              </div>
              <span className="text-[10px] font-bold text-secondary uppercase tracking-widest leading-tight">{kpi.label}</span>
            </div>
            <p className="text-xl font-headline font-bold text-on-surface whitespace-nowrap">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* ── Branch Comparison (All Branches only) ── */}
      {isAdmin && !selectedBranch && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          {branches.map((b: BranchInfo) => {
            const branchOrders = safeData.orders.filter(o => o.branch_id === b.id);
            const branchRevenue = branchOrders.reduce((s, o) => s + o.price, 0);
            const branchBalance = branchOrders.reduce((s, o) => s + (o.price - o.paid), 0);
            return (
              <div key={b.id} className="bg-surface-container-lowest rounded-xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-lg">store</span>
                  <h3 className="font-headline font-bold text-sm">{b.prefix} — {b.name_en}</h3>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-secondary uppercase font-bold mb-0.5">{t('Revenue')}</p>
                    <p className="text-sm font-headline font-bold">{formatCurrency(branchRevenue)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-secondary uppercase font-bold mb-0.5">{t('Orders')}</p>
                    <p className="text-sm font-headline font-bold">{branchOrders.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-secondary uppercase font-bold mb-0.5">{t('Balance Due')}</p>
                    <p className="text-sm font-headline font-bold text-tertiary">{formatCurrency(branchBalance)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Over Time */}
        <div className="lg:col-span-2 bg-surface-container-lowest p-5 rounded-xl">
          <h3 className="font-headline font-bold text-sm mb-4">{t('Revenue Over Time')}</h3>
          {dailyStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-secondary">
              <span className="material-symbols-outlined text-3xl mb-1">bar_chart</span>
              <p className="text-xs">{t('No data for the selected period.')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#763952" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#763952" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e8e9" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#807381" tickFormatter={(v: string) => v.slice(5)} />
                <YAxis tick={{ fontSize: 10 }} stroke="#807381" />
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#763952" fill="url(#gradRevenue)" strokeWidth={2} name={t('Revenue')} />
                <Area type="monotone" dataKey="orders" stroke="#505f76" fill="transparent" strokeWidth={1.5} strokeDasharray="4 2" name={t('Orders')} />
                <Legend iconType="line" wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status Distribution */}
        <div className="bg-surface-container-lowest p-5 rounded-xl">
          <h3 className="font-headline font-bold text-sm mb-4">{t('Order Status')}</h3>
          {statusDistribution.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-secondary">
              <span className="material-symbols-outlined text-3xl mb-1">pie_chart</span>
              <p className="text-xs">{t('No data.')}</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} innerRadius={45} paddingAngle={2}>
                  {statusDistribution.map((entry, i) => <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, border: 'none', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Daily Revenue Bar Chart ── */}
      <div className="bg-surface-container-lowest p-5 rounded-xl mb-8">
        <h3 className="font-headline font-bold text-sm mb-4">{t('Daily Revenue')}</h3>
        {dailyStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-44 text-secondary">
            <span className="material-symbols-outlined text-3xl mb-1">bar_chart</span>
            <p className="text-xs">{t('No revenue data.')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e8e9" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#807381" tickFormatter={(v: string) => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} stroke="#807381" />
              <Tooltip contentStyle={{ borderRadius: 8, border: 'none', fontSize: 12 }} formatter={(value: number) => [formatCurrency(value), t('Revenue')]} />
              <Bar dataKey="revenue" fill="#763952" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Worker Performance Table ── */}
      {safeData.workerPerformance.length > 0 && (
        <section className="bg-surface-container-lowest rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-surface-container flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">engineering</span>
            <h3 className="font-headline font-bold text-sm">{t('Worker Performance')}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Worker')}</th>
                  <th className="text-center">{t('Orders')}</th>
                  <th className="text-center">%</th>
                  <th className="text-right">{t('Revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {safeData.workerPerformance.map(w => (
                  <tr key={w.worker_id}>
                    <td className="font-semibold text-sm">{w.worker_name}</td>
                    <td className="text-center font-headline font-bold">{w.order_count}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-1.5 bg-surface-container rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${w.percentage}%` }} />
                        </div>
                        <span className="text-xs font-bold text-secondary">{w.percentage}%</span>
                      </div>
                    </td>
                    <td className="text-right font-headline font-bold text-sm">{formatCurrency(w.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Orders Table ── */}
      <section className="bg-surface-container-lowest rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-container flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
            <h3 className="font-headline font-bold text-sm">{t('Orders')}</h3>
          </div>
          <span className="text-[10px] text-secondary font-bold">{safeData.orders.length} {t('orders')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Order')}</th>
                {isAdmin && !selectedBranch && <th>{t('Branch')}</th>}
                <th>{t('Customer')}</th>
                <th>{t('Service')}</th>
                <th>{t('Status')}</th>
                <th className="text-right">{t('Value')}</th>
                <th className="text-right">{t('Balance')}</th>
              </tr>
            </thead>
            <tbody>
              {safeData.orders.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin && !selectedBranch ? 7 : 6} className="text-center py-10 text-secondary">
                    <span className="material-symbols-outlined text-3xl mb-1 block">inbox</span>
                    <span className="text-xs">{t('No orders match the selected filters.')}</span>
                  </td>
                </tr>
              ) : safeData.orders.map(o => (
                <tr key={o.id}>
                  <td className="font-headline font-bold text-sm text-primary">{o.order_number}</td>
                  {isAdmin && !selectedBranch && <td className="text-xs font-bold text-secondary">{branchPrefix(o.branch_id!)}</td>}
                  <td className="text-sm font-semibold">{o.customer_name || '--'}</td>
                  <td className="text-sm">{o.piece_type}</td>
                  <td><span className={`chip ${statusChipClass(o.status)}`}>{statusLabel(o.status)}</span></td>
                  <td className="text-right font-headline font-bold text-sm">{formatCurrency(o.price)}</td>
                  <td className={`text-right font-headline font-bold text-sm ${o.price - o.paid > 0 ? 'text-tertiary' : 'text-on-surface'}`}>{formatCurrency(o.price - o.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Email Modal ── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ animation: 'modalBackdropIn 200ms ease-out forwards' }}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowEmailModal(false)} />
          <div className="relative bg-surface-container-lowest rounded-2xl p-6 w-full max-w-md shadow-2xl" style={{ animation: 'modalContentIn 250ms ease-out forwards' }}>
            <h3 className="font-headline font-bold text-lg mb-5">{t('Send Report via Email')}</h3>
            <div className="mb-4">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">{t('Recipient Email')}</label>
              <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="email@example.com" className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            </div>
            {savedEmails.length > 0 && (
              <div className="mb-4">
                <label className="text-[10px] font-bold text-secondary uppercase tracking-wider block mb-1">{t('Saved Emails')}</label>
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {savedEmails.map(se => (
                    <div key={se.id} className="flex items-center justify-between bg-surface-container-low rounded-lg px-3 py-1.5">
                      <button onClick={() => setEmailTo(se.email)} className="text-xs text-on-surface hover:text-primary text-left flex-1 truncate">{se.email}</button>
                      <button onClick={async () => { try { await window.electronAPI.reports.deleteEmail(se.id); } catch {} setSavedEmails((await window.electronAPI.reports.getEmails()) || []); }} className="ml-2 text-error"><span className="material-symbols-outlined text-sm">close</span></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {emailError === 'smtp' && <p className="text-[10px] text-tertiary-fixed mb-2">{t('SMTP not configured. Opened email client instead.')}</p>}
            {emailError && emailError !== 'smtp' && <p className="text-[10px] text-error mb-2">{emailError}</p>}
            <p className="text-[10px] text-secondary mb-5">{t('The report PDF will be generated and attached to the email.')}</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 rounded-lg font-headline font-bold text-sm text-secondary">{t('Cancel')}</button>
              <button onClick={handleSendEmail} disabled={!emailTo} className="px-4 py-2 bg-primary text-on-primary rounded-lg font-headline font-bold text-sm hover:opacity-90 disabled:opacity-50">{emailSent ? t('Sent!') : t('Send')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
