import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../contexts/I18nContext';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface User {
  id: number;
  name: string;
  username: string;
  role: string;
  worker_type?: string | null;
  branch_id: number;
  base_salary: number;
  active: number;
}

interface Branch {
  id: number;
  name_ar: string;
  name_en: string;
  prefix: string;
  address?: string;
  phone?: string;
}

interface UserFormValues {
  name: string;
  username: string;
  password: string;
  role: string;
  worker_type: string;
  branch_id: number;
  base_salary: number;
}

interface BranchFormValues {
  name_ar: string;
  name_en: string;
  prefix: string;
  address: string;
  phone: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TABS = [
  { id: 'shop', label: 'Shop Info', icon: 'storefront' },
  { id: 'users', label: 'Users', icon: 'group' },
  { id: 'branches', label: 'Branches', icon: 'store' },
  { id: 'invoice', label: 'Invoice', icon: 'receipt' },
  { id: 'preferences', label: 'Preferences', icon: 'tune' },
] as const;

type TabId = (typeof TABS)[number]['id'];

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  reception: 'Reception',
  worker: 'Worker',
} as const;

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  admin: { bg: 'bg-primary-fixed', text: 'text-on-primary-fixed' },
  manager: { bg: 'bg-secondary-container', text: 'text-on-secondary-container' },
  reception: { bg: 'bg-tertiary-fixed', text: 'text-on-tertiary-fixed' },
  worker: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant' },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('shop');
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale, setCurrency } = useTranslation();
  const [settings, setSettingsState] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const INVOICE_TOGGLES = [
    { key: 'invoice_show_shop_name', label: 'Shop Name', desc: 'Shop name (Arabic & English)', icon: 'storefront' },
    { key: 'invoice_show_branch_info', label: 'Branch Info', desc: 'Branch name and prefix', icon: 'store' },
    { key: 'invoice_show_phone', label: 'Phone Number', desc: 'Phone number shown in header', icon: 'phone' },
    { key: 'invoice_show_worker_name', label: 'Worker Name', desc: 'Name of the assigned worker', icon: 'person' },
    { key: 'invoice_show_worker_phone', label: 'Worker Phone', desc: 'Phone number of the assigned worker', icon: 'phone' },
    { key: 'invoice_show_delivery_date', label: 'Delivery Date', desc: 'Expected delivery/receipt date', icon: 'event' },
    { key: 'invoice_show_payment_method', label: 'Payment Method', desc: 'Cash or Card payment method', icon: 'payments' },
    { key: 'invoice_show_shop_logo', label: 'Shop Logo / Icon', desc: 'Shop logo or decorative icon', icon: 'styler' },
    { key: 'invoice_show_notes', label: 'Notes & Disclaimer', desc: 'Shop responsibility disclaimer', icon: 'info' },
  ] as const;

  const INVOICE_SECTIONS = [
    { key: 'shop_logo', label: 'Shop Logo / Icon', icon: 'styler' },
    { key: 'shop_name', label: 'Shop Name', icon: 'storefront' },
    { key: 'branch_info', label: 'Branch Info', icon: 'store' },
    { key: 'phone', label: 'Phone', icon: 'phone' },
    { key: 'invoice_details', label: 'Invoice & Customer Info', icon: 'receipt' },
    { key: 'worker_name', label: 'Worker Name', icon: 'person' },
    { key: 'items', label: 'Items & Services', icon: 'checklist' },
    { key: 'totals', label: 'Totals (Total / Paid / Balance)', icon: 'calculate' },
    { key: 'previous_balance', label: 'Previous Orders Balance', icon: 'account_balance_wallet' },
    { key: 'payment_method', label: 'Payment Method', icon: 'payments' },
    { key: 'dates', label: 'Dates', icon: 'event' },
    { key: 'payment_status', label: 'Payment Status', icon: 'verified' },
    { key: 'notes', label: 'Notes & Disclaimer', icon: 'info' },
    { key: 'footer', label: 'Footer', icon: 'format_quote' },
  ] as const;

  const [invoiceToggles, setInvoiceToggles] = useState<Record<string, boolean>>({});
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);
  const [actionMenuId, setActionMenuId] = useState<number | null>(null);
  const [actionMenuPos, setActionMenuPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UserFormValues>();

  const {
    register: regBranch,
    handleSubmit: submitBranch,
    reset: resetBranch,
    formState: { errors: branchErrors, isSubmitting: branchSubmitting },
  } = useForm<BranchFormValues>();

  /* ---- Data loading ---- */

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [settingsData, usersData, branchesData] = await Promise.all([
        window.electronAPI.settings.getAll(),
        window.electronAPI.users.getAll(),
        window.electronAPI.branches.getAll(),
      ]);
      setSettingsState(settingsData || {});
      setUsers(usersData || []);
      setBranches(branchesData || []);

      // Initialize invoice toggle state from settings
      const toggleState: Record<string, boolean> = {};
      for (const tg of INVOICE_TOGGLES) {
        toggleState[tg.key] = (settingsData as Record<string, string>)?.[tg.key] !== '0';
      }
      setInvoiceToggles(toggleState);

      // Initialize section order from settings
      try {
        const orderStr = (settingsData as Record<string, string>)?.invoice_section_order;
        const parsed = orderStr ? JSON.parse(orderStr) : null;
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSectionOrder(parsed);
        } else {
          setSectionOrder(INVOICE_SECTIONS.map(s => s.key));
        }
      } catch {
        setSectionOrder(INVOICE_SECTIONS.map(s => s.key));
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    window.electronAPI.updater.getVersion().then((v) => setAppVersion(v)).catch(() => {});

    const unsubAvailable = window.electronAPI.updater.onUpdateAvailable((info) => {
      setUpdateStatus('downloading');
      setUpdateVersion(info.version);
    });
    const unsubNotAvailable = window.electronAPI.updater.onUpdateNotAvailable(() => {
      setUpdateStatus('not-available');
    });
    const unsubDownloaded = window.electronAPI.updater.onUpdateDownloaded(() => {
      setUpdateStatus('downloaded');
      setDownloadProgress(100);
    });
    const unsubError = window.electronAPI.updater.onUpdateError((msg) => {
      setUpdateStatus('error');
      console.error('Update error:', msg);
    });
    const unsubProgress = window.electronAPI.updater.onDownloadProgress((progress) => {
      setDownloadProgress(Math.round(progress.percent));
    });

    return () => {
      unsubAvailable();
      unsubNotAvailable();
      unsubDownloaded();
      unsubError();
      unsubProgress();
    };
  }, []);

  /* ---- Click-away for action menu ---- */

  useEffect(() => {
    if (actionMenuId === null) return;
    const handler = () => setActionMenuId(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [actionMenuId]);

  /* ---- Shop Info save ---- */

  const handleShopSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const updates: Record<string, string> = {};
    for (const [key, value] of data.entries()) {
      updates[key] = value as string;
    }
    try {
      setSaving(true);
      await window.electronAPI.settings.set(updates);
      setSettingsState((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Failed to save shop info:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- Preferences save ---- */

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking');
    setDownloadProgress(0);
    try {
      await window.electronAPI.updater.check();
    } catch {
      setUpdateStatus('error');
    }
  };

  const handlePrefsSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const updates: Record<string, string> = {};
    for (const [key, value] of data.entries()) {
      updates[key] = value as string;
    }
    try {
      setSaving(true);
      await window.electronAPI.settings.set(updates);
      setSettingsState((prev) => ({ ...prev, ...updates }));
      if (updates.currency) setCurrency(updates.currency);
      if (updates.locale) setLocale(updates.locale as 'en' | 'ar');
    } catch (err) {
      console.error('Failed to save preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- Invoice toggles save ---- */

  const handleInvoiceSave = async () => {
    try {
      setSaving(true);
      const updates: Record<string, string> = {};
      // Toggle values
      for (const tg of INVOICE_TOGGLES) {
        updates[tg.key] = invoiceToggles[tg.key] ? '1' : '0';
      }
      // Text fields from DOM
      const headerEl = document.querySelector('[name="invoice_header_text"]') as HTMLInputElement | null;
      const footerEl = document.querySelector('[name="receipt_footer"]') as HTMLTextAreaElement | null;
      const shopArEl = document.querySelector('[name="invoice_shop_name_ar"]') as HTMLInputElement | null;
      const shopEnEl = document.querySelector('[name="invoice_shop_name_en"]') as HTMLInputElement | null;
      if (headerEl) updates.invoice_header_text = headerEl.value;
      if (footerEl) updates.receipt_footer = footerEl.value;
      if (shopArEl) updates.invoice_shop_name_ar = shopArEl.value;
      if (shopEnEl) updates.invoice_shop_name_en = shopEnEl.value;
      // Section order
      updates.invoice_section_order = JSON.stringify(sectionOrder);

      await window.electronAPI.settings.set(updates);
      setSettingsState((prev) => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('Failed to save invoice settings:', err);
    } finally {
      setSaving(false);
    }
  };

  /* ---- User modal ---- */

  const openAddUser = () => {
    setEditingUser(null);
    reset({
      name: '',
      username: '',
      password: '',
      role: 'reception',
      worker_type: 'tailor',
      branch_id: branches.length > 0 ? branches[0].id : 1,
      base_salary: 0,
    });
    setUserModalOpen(true);
  };

  const openEditUser = (user: User) => {
    setEditingUser(user);
    reset({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      worker_type: user.worker_type || 'tailor',
      branch_id: user.branch_id,
      base_salary: user.base_salary || 0,
    });
    setUserModalOpen(true);
    setActionMenuId(null);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    setEditingUser(null);
    setShowPassword(false);
  };

  const onUserSubmit = async (data: UserFormValues) => {
    try {
      if (editingUser) {
        const updateData: any = {
          name: data.name,
          role: data.role,
          worker_type: data.role === 'worker' ? data.worker_type || null : null,
          branch_id: data.branch_id,
          base_salary: Number(data.base_salary) || 0,
        };
        if (data.password) {
          updateData.password = data.password;
        }
        await window.electronAPI.users.update(editingUser.id, updateData);
      } else {
        await window.electronAPI.users.create({
          name: data.name,
          username: data.username,
          password: data.password,
          role: data.role,
          worker_type: data.role === 'worker' ? data.worker_type || null : null,
          branch_id: data.branch_id,
          base_salary: Number(data.base_salary) || 0,
        });
      }
      closeUserModal();
      await loadData();
    } catch (err) {
      console.error('Failed to save user:', err);
    }
  };

  const handleDeactivateUser = async (user: User) => {
    if (!window.confirm(t('Deactivate user "{name}"?').replace('{name}', user.name))) return;
    try {
      await window.electronAPI.users.deactivate(user.id);
      await loadData();
    } catch (err) {
      console.error('Failed to deactivate user:', err);
    }
    setActionMenuId(null);
  };

  /* ---- Branch modal ---- */

  const openAddBranch = () => {
    setEditingBranch(null);
    resetBranch({ name_ar: '', name_en: '', prefix: '', address: '', phone: '' });
    setBranchModalOpen(true);
  };

  const openEditBranch = (branch: Branch) => {
    setEditingBranch(branch);
    resetBranch({
      name_ar: branch.name_ar,
      name_en: branch.name_en,
      prefix: branch.prefix,
      address: branch.address || '',
      phone: branch.phone || '',
    });
    setBranchModalOpen(true);
  };

  const closeBranchModal = () => {
    setBranchModalOpen(false);
    setEditingBranch(null);
  };

  const onBranchSubmit = async (data: BranchFormValues) => {
    try {
      if (editingBranch) {
        await window.electronAPI.branches.update(editingBranch.id, {
          name_ar: data.name_ar,
          name_en: data.name_en,
          prefix: data.prefix,
          address: data.address || null,
          phone: data.phone || null,
        });
      } else {
        await window.electronAPI.branches.create({
          name_ar: data.name_ar,
          name_en: data.name_en,
          prefix: data.prefix,
          address: data.address || null,
          phone: data.phone || null,
        });
      }
      closeBranchModal();
      await loadData();
    } catch (err) {
      console.error('Failed to save branch:', err);
    }
  };

  /* ---- Render helpers ---- */

  const watchedRole = editingUser?.role;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-secondary">
        <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
        {t('Loading settings...')}
      </div>
    );
  }

  return (
    <div className="pb-12">
      {/* Header */}
      <header className="mb-10">
        <h1 className="text-5xl font-headline font-extrabold text-on-surface tracking-tight mb-3">
          {t('Settings')}
        </h1>
        <p className="text-lg text-secondary max-w-2xl leading-relaxed">
          {t('Manage your shop info, user accounts, branches, and system preferences.')}
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-10 border-b border-surface-container-high pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-headline font-bold tracking-wide uppercase transition-all border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-secondary hover:text-on-surface hover:border-outline-variant'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {t(tab.label)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'shop' && (
        <form onSubmit={handleShopSave} className="max-w-2xl space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">storefront</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t('Shop Details')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Shop Name (Arabic)')}
                </label>
                <input
                  name="shop_name_ar"
                  type="text"
                  className="input-field"
                  defaultValue={settings.shop_name_ar || ''}
                  dir="rtl"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Shop Name (English)')}
                </label>
                <input
                  name="shop_name_en"
                  type="text"
                  className="input-field"
                  defaultValue={settings.shop_name_en || ''}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                {t('Phone Number')}
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-4 text-outline">phone</span>
                <input
                  name="shop_phone"
                  type="tel"
                  className="input-field pl-12"
                  defaultValue={settings.shop_phone || ''}
                  placeholder="+974 XXXX XXXX"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving && (
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              )}
              {saving ? t('Saving...') : t('Save Changes')}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={openAddUser}
              className="btn-primary flex items-center gap-3 py-3 px-8 text-sm shadow-xl hover:opacity-90 active:scale-95"
            >
              <span className="material-symbols-outlined">person_add</span>
              {t('Add User')}
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-secondary">
                <span className="material-symbols-outlined text-5xl mb-3 text-outline">group</span>
                <p className="font-headline font-bold text-on-surface text-lg">{t('No users found')}</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('Name')}</th>
                    <th>{t('Username')}</th>
                    <th>{t('Role')}</th>
                    <th>{t('Branch')}</th>
                    <th>{t('Status')}</th>
                    <th className="text-right">{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const roleColor = ROLE_COLORS[user.role] || ROLE_COLORS.worker;
                    const branch = branches.find((b) => b.id === user.branch_id);
                    return (
                      <tr key={user.id}>
                        <td>
                          <span className="font-bold text-on-surface">{user.name}</span>
                          {user.role === 'worker' && user.worker_type && (
                            <span className="text-xs text-secondary ml-2">
                              ({user.worker_type === 'master_cutter' ? t('Master Cutter') : user.worker_type === 'tailor' ? t('Tailor') : user.worker_type})
                            </span>
                          )}
                        </td>
                        <td className="text-secondary text-sm">{user.username}</td>
                        <td>
                          <span
                            className={`px-3 py-1 ${roleColor.bg} ${roleColor.text} text-[11px] font-bold uppercase rounded-full`}
                          >
                            {t(ROLE_LABELS[user.role] || user.role)}
                          </span>
                        </td>
                        <td className="text-sm">{branch?.name_en || '--'}</td>
                        <td>
                          <span
                            className={`px-3 py-1 text-[11px] font-bold uppercase rounded-full ${
                              user.active
                                ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                                : 'bg-surface-container-high text-on-surface-variant'
                            }`}
                          >
                            {user.active ? t('Active') : t('Inactive')}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="relative inline-block">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (actionMenuId === user.id) {
                                  setActionMenuId(null);
                                  setActionMenuPos(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const up = window.innerHeight - rect.bottom < 120;
                                  setActionMenuPos({
                                    top: up ? rect.top - 4 : rect.bottom + 4,
                                    right: window.innerWidth - rect.right,
                                    up,
                                  });
                                  setActionMenuId(user.id);
                                }
                              }}
                              className="text-outline hover:text-primary transition-colors p-1"
                            >
                              <span className="material-symbols-outlined">more_vert</span>
                            </button>
                            {actionMenuId === user.id && actionMenuPos && (
                              <div
                                className="fixed bg-surface-container-lowest rounded-lg shadow-lg border border-outline-variant/20 z-50 min-w-[160px] py-1"
                                style={{
                                  top: actionMenuPos.top,
                                  right: actionMenuPos.right,
                                  transform: actionMenuPos.up ? 'translateY(-100%)' : undefined,
                                }}
                              >
                                <button
                                  onClick={() => openEditUser(user)}
                                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container transition-colors flex items-center gap-2"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                  {t('Edit User')}
                                </button>
                                {user.active && (
                                  <button
                                    onClick={() => handleDeactivateUser(user)}
                                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container transition-colors flex items-center gap-2 text-error"
                                  >
                                    <span className="material-symbols-outlined text-base">person_remove</span>
                                    {t('Deactivate')}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {users.length > 0 && (
              <div className="px-6 py-4 border-t border-surface-container-high text-xs font-medium uppercase tracking-widest text-secondary">
                {users.length} {t('user(s)')}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={openAddBranch}
              className="btn-primary flex items-center gap-3 py-3 px-8 text-sm shadow-xl hover:opacity-90 active:scale-95"
            >
              <span className="material-symbols-outlined">add_business</span>
              {t('Add Branch')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="bg-surface-container-lowest rounded-2xl p-8 border-b-4 border-primary shadow-[0px_20px_40px_rgba(25,28,29,0.04)]"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-fixed flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-primary text-xl"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        store
                      </span>
                    </div>
                    <div>
                      <h4 className="font-headline font-bold text-on-surface text-lg">
                        {branch.name_en}
                      </h4>
                      <p className="text-sm text-secondary" dir="rtl">
                        {branch.name_ar}
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-primary-fixed text-on-primary-fixed text-sm font-bold rounded-full">
                    {branch.prefix}-XXX
                  </span>
                </div>

                <div className="space-y-2 mb-6">
                  {branch.address && (
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <span className="material-symbols-outlined text-base">location_on</span>
                      {branch.address}
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <span className="material-symbols-outlined text-base">phone</span>
                      {branch.phone}
                    </div>
                  )}
                  {!branch.address && !branch.phone && (
                    <div className="flex items-center gap-2 text-sm text-secondary">
                      <span className="material-symbols-outlined text-base">info</span>
                      {t('No address or phone set')}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => openEditBranch(branch)}
                  className="text-primary font-headline font-bold text-xs uppercase tracking-widest hover:underline flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  {t('Edit Branch')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'invoice' && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl p-8 space-y-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-primary text-xl">receipt</span>
                <h3 className="font-headline font-bold text-lg text-on-surface">{t('Invoice Components')}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allOn: Record<string, boolean> = {};
                    for (const tg of INVOICE_TOGGLES) allOn[tg.key] = true;
                    setInvoiceToggles(allOn);
                  }}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {t('Select All')}
                </button>
                <span className="text-outline-variant">|</span>
                <button
                  type="button"
                  onClick={() => {
                    const allOff: Record<string, boolean> = {};
                    for (const tg of INVOICE_TOGGLES) allOff[tg.key] = false;
                    setInvoiceToggles(allOff);
                  }}
                  className="text-xs font-bold text-secondary hover:text-on-surface hover:underline"
                >
                  {t('Deselect All')}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              {INVOICE_TOGGLES.map((tg) => (
                <div
                  key={tg.key}
                  className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-outline text-lg">{tg.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">{t(tg.label)}</div>
                      <div className="text-xs text-secondary">{t(tg.desc)}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={invoiceToggles[tg.key] !== false}
                    onClick={() => setInvoiceToggles((prev) => ({ ...prev, [tg.key]: prev[tg.key] === false }))}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      invoiceToggles[tg.key] !== false ? 'bg-primary' : 'bg-surface-container-high'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        invoiceToggles[tg.key] !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Text Fields */}
          <div className="bg-surface-container-lowest rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">edit_note</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t('Invoice Text')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Invoice Shop Name (Arabic)')}
                </label>
                <input
                  name="invoice_shop_name_ar"
                  type="text"
                  className="input-field"
                  dir="rtl"
                  defaultValue={settings.invoice_shop_name_ar || ''}
                  placeholder={settings.shop_name_ar || t('Shop Name (Arabic)')}
                />
                <p className="text-[11px] text-secondary mt-1 px-1">{t('Leave empty to use default shop name')}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Invoice Shop Name (English)')}
                </label>
                <input
                  name="invoice_shop_name_en"
                  type="text"
                  className="input-field"
                  defaultValue={settings.invoice_shop_name_en || ''}
                  placeholder={settings.shop_name_en || t('Shop Name (English)')}
                />
                <p className="text-[11px] text-secondary mt-1 px-1">{t('Leave empty to use default shop name')}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                {t('Header Text')}
              </label>
              <input
                name="invoice_header_text"
                type="text"
                className="input-field"
                defaultValue={settings.invoice_header_text || ''}
                placeholder={t('Custom text shown below the shop name')}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                {t('Footer Text')}
              </label>
              <textarea
                name="receipt_footer"
                rows={3}
                className="input-field resize-none"
                defaultValue={settings.receipt_footer || ''}
                placeholder={t('Text shown at the bottom of printed invoices')}
              />
            </div>
          </div>

          {/* Section Order */}
          <div className="bg-surface-container-lowest rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">reorder</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t('Section Order')}</h3>
            </div>
            <p className="text-xs text-secondary -mt-3">{t('Drag or use arrows to reorder invoice sections')}</p>

            <div className="space-y-1">
              {sectionOrder.map((key, idx) => {
                const section = INVOICE_SECTIONS.find(s => s.key === key);
                if (!section) return null;
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 py-2.5 px-4 rounded-xl bg-surface-container/50"
                  >
                    <span className="text-xs font-mono text-secondary w-5 text-center">{idx + 1}</span>
                    <span className="material-symbols-outlined text-outline text-lg">{section.icon}</span>
                    <span className="text-sm font-medium text-on-surface flex-1">{t(section.label)}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => {
                          const newOrder = [...sectionOrder];
                          [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];
                          setSectionOrder(newOrder);
                        }}
                        className="p-1 rounded hover:bg-surface-container-high disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">keyboard_arrow_up</span>
                      </button>
                      <button
                        type="button"
                        disabled={idx === sectionOrder.length - 1}
                        onClick={() => {
                          const newOrder = [...sectionOrder];
                          [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
                          setSectionOrder(newOrder);
                        }}
                        className="p-1 rounded hover:bg-surface-container-high disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                      >
                        <span className="material-symbols-outlined text-base">keyboard_arrow_down</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setSectionOrder(INVOICE_SECTIONS.map(s => s.key))}
              className="text-xs font-bold text-secondary hover:text-on-surface hover:underline"
            >
              {t('Reset to Default Order')}
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleInvoiceSave}
              className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving && (
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              )}
              {saving ? t('Saving...') : t('Save Changes')}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'preferences' && (
        <form onSubmit={handlePrefsSave} className="max-w-2xl space-y-6">
          <div className="bg-surface-container-lowest rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">tune</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t('System Preferences')}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Theme')}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">
                    {theme === 'dark' ? 'dark_mode' : 'light_mode'}
                  </span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                    className="input-field pl-12 appearance-none"
                  >
                    <option value="light">{t('Light')}</option>
                    <option value="dark">{t('Dark')}</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Language')}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">
                    translate
                  </span>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as 'en' | 'ar')}
                    className="input-field pl-12 appearance-none"
                  >
                    <option value="en">{t('English')}</option>
                    <option value="ar">{t('Arabic')}</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Currency')}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">paid</span>
                  <select
                    name="currency"
                    className="input-field pl-12 appearance-none"
                    defaultValue={settings.currency || 'QAR'}
                  >
                    <option value="QAR">{t('QAR - Qatari Riyal')}</option>
                    <option value="SAR">{t('SAR - Saudi Riyal')}</option>
                    <option value="AED">{t('AED - UAE Dirham')}</option>
                    <option value="USD">{t('USD - US Dollar')}</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                    expand_more
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Tax Rate (%)')}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">percent</span>
                  <input
                    name="tax_rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    className="input-field pl-12"
                    defaultValue={settings.tax_rate || '0'}
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-outline-variant/20" />

            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">mail</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t('Email Settings')}</h3>
            </div>
            <p className="text-xs text-secondary mb-4">{t('Enter your email, then generate an app password from your provider.')}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('Your Email')}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">mail</span>
                  <input
                    name="smtp_user"
                    type="email"
                    className="input-field pl-12"
                    defaultValue={settings.smtp_user || ''}
                    placeholder={t('your-email@gmail.com')}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase();
                      const fromEl = document.querySelector('[name="smtp_from"]') as HTMLInputElement;
                      const hostEl = document.querySelector('[name="smtp_host"]') as HTMLInputElement;
                      const portEl = document.querySelector('[name="smtp_port"]') as HTMLInputElement;
                      const secEl = document.querySelector('[name="smtp_secure"]') as HTMLSelectElement;
                      if (fromEl) fromEl.value = val;

                      const presets: Record<string, { host: string; port: string; secure: string }> = {
                        'gmail.com': { host: 'smtp.gmail.com', port: '587', secure: 'tls' },
                        'googlemail.com': { host: 'smtp.gmail.com', port: '587', secure: 'tls' },
                        'outlook.com': { host: 'smtp.office365.com', port: '587', secure: 'tls' },
                        'hotmail.com': { host: 'smtp.office365.com', port: '587', secure: 'tls' },
                        'live.com': { host: 'smtp.office365.com', port: '587', secure: 'tls' },
                        'yahoo.com': { host: 'smtp.mail.yahoo.com', port: '465', secure: 'ssl' },
                        'icloud.com': { host: 'smtp.mail.me.com', port: '587', secure: 'tls' },
                        'me.com': { host: 'smtp.mail.me.com', port: '587', secure: 'tls' },
                        'zoho.com': { host: 'smtp.zoho.com', port: '465', secure: 'ssl' },
                      };
                      const domain = val.split('@')[1];
                      const p = domain ? presets[domain] : undefined;
                      if (p) {
                        if (hostEl) hostEl.value = p.host;
                        if (portEl) portEl.value = p.port;
                        if (secEl) secEl.value = p.secure;
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                  {t('App Password')}
                </label>
                <div className="relative flex items-center">
                  <span className="material-symbols-outlined absolute left-4 text-outline">key</span>
                  <input
                    name="smtp_pass"
                    type="password"
                    className="input-field pl-12 pr-36"
                    defaultValue={settings.smtp_pass || ''}
                    placeholder={t('Paste your app password here')}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const email = (document.querySelector('[name="smtp_user"]') as HTMLInputElement)?.value || '';
                      const domain = email.split('@')[1]?.toLowerCase();
                      const urls: Record<string, string> = {
                        'gmail.com': 'https://myaccount.google.com/apppasswords',
                        'googlemail.com': 'https://myaccount.google.com/apppasswords',
                        'outlook.com': 'https://account.live.com/proofs/AppPassword',
                        'hotmail.com': 'https://account.live.com/proofs/AppPassword',
                        'live.com': 'https://account.live.com/proofs/AppPassword',
                        'yahoo.com': 'https://login.yahoo.com/account/security/app-passwords',
                        'icloud.com': 'https://appleid.apple.com/account/manage',
                        'me.com': 'https://appleid.apple.com/account/manage',
                        'zoho.com': 'https://accounts.zoho.com/apppassword',
                      };
                      const url = urls[domain || ''] || 'https://myaccount.google.com/apppasswords';
                      window.electronAPI.shell.openExternal(url);
                    }}
                    className="absolute right-2 flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-[11px] font-bold hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    {t('Get Password')}
                  </button>
                </div>
                <p className="text-[11px] text-secondary mt-1.5 px-1">
                  {t('Click "Get Password" to open your email provider\'s app password page in the browser.')}
                </p>
              </div>

              <details className="group">
                <summary className="flex items-center gap-2 text-xs font-bold text-secondary cursor-pointer hover:text-on-surface transition-colors py-2">
                  <span className="material-symbols-outlined text-sm group-open:rotate-180 transition-transform">expand_more</span>
                  {t('Advanced SMTP Settings')}
                </summary>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Sender Name')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">badge</span>
                      <input
                        name="smtp_from_name"
                        type="text"
                        className="input-field pl-12"
                        defaultValue={settings.smtp_from_name || ''}
                        placeholder={t('My Shop')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Sender Email')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">alternate_email</span>
                      <input
                        name="smtp_from"
                        type="email"
                        className="input-field pl-12"
                        defaultValue={settings.smtp_from || ''}
                        placeholder={t('sender@example.com')}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('SMTP Host')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">dns</span>
                      <input
                        name="smtp_host"
                        type="text"
                        className="input-field pl-12"
                        defaultValue={settings.smtp_host || ''}
                        placeholder="smtp.gmail.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('SMTP Port')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">settings_ethernet</span>
                      <input
                        name="smtp_port"
                        type="number"
                        className="input-field pl-12"
                        defaultValue={settings.smtp_port || '587'}
                        placeholder="587"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Encryption')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">lock</span>
                      <select
                        name="smtp_secure"
                        className="input-field pl-12 appearance-none"
                        defaultValue={settings.smtp_secure || 'tls'}
                      >
                        <option value="tls">{t('TLS (port 587)')}</option>
                        <option value="ssl">{t('SSL (port 465)')}</option>
                        <option value="none">{t('None')}</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                        expand_more
                      </span>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {saving && (
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              )}
              {saving ? t('Saving...') : t('Save Preferences')}
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-primary text-xl">system_update</span>
              <h3 className="font-headline font-bold text-lg text-on-surface">{t('About & Updates')}</h3>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-outline text-lg">info</span>
                <div>
                  <div className="text-sm font-semibold text-on-surface">
                    {t('Etiquette Tailor')} <span className="text-secondary font-normal">v{appVersion}</span>
                  </div>
                  <div className="text-xs text-secondary">
                    {updateStatus === 'not-available' && t('You are on the latest version')}
                    {updateStatus === 'error' && t('Could not check for updates')}
                  </div>
                </div>
              </div>

              {updateStatus === 'downloaded' ? (
                <button
                  type="button"
                  onClick={() => window.electronAPI.updater.quitAndInstall()}
                  className="btn-primary px-6 py-2.5 text-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">restart_alt</span>
                  {t('Restart & Install')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckForUpdates}
                  disabled={updateStatus === 'checking' || updateStatus === 'downloading'}
                  className="px-6 py-2.5 text-sm flex items-center gap-2 rounded-lg border border-outline-variant text-on-surface hover:bg-surface-container transition-colors disabled:opacity-50"
                >
                  {(updateStatus === 'checking' || updateStatus === 'downloading') && (
                    <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                  )}
                  {updateStatus === 'checking' && t('Checking...')}
                  {updateStatus === 'downloading' && t('Downloading {progress}%').replace('{progress}', String(downloadProgress))}
                  {updateStatus === 'idle' && t('Check for Updates')}
                  {updateStatus === 'not-available' && t('Check for Updates')}
                  {updateStatus === 'error' && t('Retry')}
                  {updateStatus === 'available' && t('Check for Updates')}
                </button>
              )}
            </div>

            {updateStatus === 'downloading' && (
              <div className="w-full bg-surface-container-high rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}

            {updateStatus === 'downloaded' && updateVersion && (
              <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 rounded-xl">
                <span className="material-symbols-outlined text-primary text-lg">new_releases</span>
                <span className="text-sm text-primary font-semibold">
                  {t('Version {version} is ready to install').replace('{version}', updateVersion)}
                </span>
              </div>
            )}
          </div>
        </form>
      )}

      {/* ---- User Modal ---- */}
      {userModalOpen && (
        <div className="modal-backdrop" onClick={closeUserModal}>
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content w-full max-w-xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-6 md:px-8 md:py-8">
                {/* Modal Header */}
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-white">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {editingUser ? 'edit' : 'person_add'}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
                        {editingUser ? t('Edit User') : t('New User')}
                      </h2>
                      <p className="text-secondary text-xs mt-0.5">
                        {editingUser ? t('Update user information') : t('Create a new user account')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeUserModal}
                    className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onUserSubmit)} className="space-y-6">
                  {/* Personal Info */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-lg">badge</span>
                      <span className="text-xs font-headline font-bold uppercase tracking-widest text-secondary">
                        {t('Account Information')}
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                        {t('Full Name')}
                      </label>
                      <div className="relative flex items-center">
                        <span className="material-symbols-outlined absolute left-4 text-outline">person</span>
                        <input
                          {...register('name', { required: t('Name is required') })}
                          type="text"
                          className={`input-field pl-12 ${errors.name ? '!border-b-error' : ''}`}
                          placeholder={t('e.g. Ahmad Ali')}
                        />
                      </div>
                      {errors.name && (
                        <p className="text-error text-xs mt-1 ml-1">{errors.name.message}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                          {t('Username')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">alternate_email</span>
                          <input
                            {...register('username', {
                              required: !editingUser ? t('Username is required') : false,
                            })}
                            type="text"
                            className={`input-field pl-12 ${errors.username ? '!border-b-error' : ''}`}
                            placeholder={t('Login ID')}
                            disabled={!!editingUser}
                          />
                        </div>
                        {errors.username && (
                          <p className="text-error text-xs mt-1 ml-1">{errors.username.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                          {editingUser ? t('New Password') : t('Password')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">lock</span>
                          <input
                            {...register('password', {
                              required: !editingUser ? t('Password is required') : false,
                            })}
                            type={showPassword ? 'text' : 'password'}
                            className={`input-field pl-12 pr-12 ${errors.password ? '!border-b-error' : ''}`}
                            placeholder={editingUser ? t('Leave blank to keep') : t('Min 6 characters')}
                          />
                          <button
                            type="button"
                            className="absolute right-4 text-outline hover:text-primary transition-colors"
                            onClick={() => setShowPassword((v) => !v)}
                            tabIndex={-1}
                          >
                            <span className="material-symbols-outlined">
                              {showPassword ? 'visibility_off' : 'visibility'}
                            </span>
                          </button>
                        </div>
                        {errors.password && (
                          <p className="text-error text-xs mt-1 ml-1">{errors.password.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-outline-variant/20" />

                  {/* Role & Work Details */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="material-symbols-outlined text-primary text-lg">admin_panel_settings</span>
                      <span className="text-xs font-headline font-bold uppercase tracking-widest text-secondary">
                        {t('Role & Assignment')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                          {t('Role')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">shield</span>
                          <select
                            {...register('role')}
                            className="input-field pl-12 appearance-none"
                          >
                            <option value="admin">{t('Admin')}</option>
                            <option value="manager">{t('Manager')}</option>
                            <option value="reception">{t('Reception')}</option>
                            <option value="worker">{t('Worker')}</option>
                          </select>
                          <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                            expand_more
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                          {t('Branch')}
                        </label>
                        <div className="relative flex items-center">
                          <span className="material-symbols-outlined absolute left-4 text-outline">store</span>
                          <select
                            {...register('branch_id', { valueAsNumber: true })}
                            className="input-field pl-12 appearance-none"
                          >
                            {branches.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name_en}
                              </option>
                            ))}
                          </select>
                          <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                            expand_more
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Conditional: worker_type only when role=worker */}
                    {(watchedRole === 'worker' || (!editingUser)) && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                            {t('Worker Specialty')}
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-4 text-outline">styler</span>
                            <select
                              {...register('worker_type')}
                              className="input-field pl-12 appearance-none"
                            >
                              <option value="tailor">{t('Tailor')}</option>
                              <option value="master_cutter">{t('Master Cutter')}</option>
                            </select>
                            <span className="material-symbols-outlined absolute right-4 text-outline pointer-events-none text-lg">
                              expand_more
                            </span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                            {t('Base Salary')}
                          </label>
                          <div className="relative flex items-center">
                            <span className="material-symbols-outlined absolute left-4 text-outline">payments</span>
                            <input
                              {...register('base_salary', { valueAsNumber: true })}
                              type="number"
                              min="0"
                              step="0.01"
                              className="input-field pl-12"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeUserModal}
                      className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting && (
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      )}
                      {isSubmitting ? t('Saving...') : editingUser ? t('Update User') : t('Create User')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- Branch Modal ---- */}
      {branchModalOpen && (
        <div className="modal-backdrop" onClick={closeBranchModal}>
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-6 md:px-8 md:py-8">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-white">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        {editingBranch ? 'edit' : 'add_business'}
                      </span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
                        {editingBranch ? t('Edit Branch') : t('New Branch')}
                      </h2>
                      <p className="text-secondary text-xs mt-0.5">
                        {editingBranch ? t('Update branch details') : t('Add a new workshop location')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeBranchModal}
                    className="p-2 text-outline hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container-high"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <form onSubmit={submitBranch(onBranchSubmit)} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Branch Name (Arabic)')}
                    </label>
                    <input
                      {...regBranch('name_ar', { required: t('Arabic name is required') })}
                      type="text"
                      dir="rtl"
                      className={`input-field ${branchErrors.name_ar ? '!border-b-error' : ''}`}
                      placeholder={t('اسم الفرع')}
                    />
                    {branchErrors.name_ar && (
                      <p className="text-error text-xs mt-1 ml-1">{branchErrors.name_ar.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Branch Name (English)')}
                    </label>
                    <input
                      {...regBranch('name_en', { required: t('English name is required') })}
                      type="text"
                      className={`input-field ${branchErrors.name_en ? '!border-b-error' : ''}`}
                      placeholder={t('Branch name in English')}
                    />
                    {branchErrors.name_en && (
                      <p className="text-error text-xs mt-1 ml-1">{branchErrors.name_en.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Order Prefix')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">tag</span>
                      <input
                        {...regBranch('prefix', { required: t('Prefix is required') })}
                        type="text"
                        maxLength={3}
                        className={`input-field pl-12 uppercase ${branchErrors.prefix ? '!border-b-error' : ''}`}
                        placeholder={t('e.g. C')}
                      />
                    </div>
                    {branchErrors.prefix && (
                      <p className="text-error text-xs mt-1 ml-1">{branchErrors.prefix.message}</p>
                    )}
                    <p className="text-on-surface-variant text-[11px] mt-1.5 ml-1">
                      {t('Orders will be numbered: {prefix}-001, {prefix}-002, etc.', { prefix: editingBranch?.prefix || 'C' })}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Address')}
                    </label>
                    <input
                      {...regBranch('address')}
                      type="text"
                      className="input-field"
                      placeholder={t('Street / area')}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-[0.05em] text-secondary mb-2 px-1">
                      {t('Phone')}
                    </label>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-4 text-outline">phone</span>
                      <input
                        {...regBranch('phone')}
                        type="tel"
                        className="input-field pl-12"
                        placeholder={t('Branch phone number')}
                      />
                    </div>
                    <p className="text-on-surface-variant text-[11px] mt-1.5 ml-1">
                      {t('This phone will be shown on invoices for this branch')}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeBranchModal}
                      className="px-6 py-3 text-sm font-semibold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={branchSubmitting}
                      className="btn-primary px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {branchSubmitting && (
                        <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                      )}
                      {branchSubmitting ? t('Saving...') : editingBranch ? t('Update Branch') : t('Create Branch')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
