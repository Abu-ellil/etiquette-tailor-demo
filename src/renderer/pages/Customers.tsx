import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from '../contexts/I18nContext';
import { useActiveBranch } from '../contexts/BranchContext';

/* ── Types ─────────────────────────────────────────────── */

interface Customer {
  id: number;
  name: string;
  phone: string;
  notes: string;
  branch_id: number;
  is_deleted?: number;
}

interface CustomerFormValues {
  name: string;
  phone: string;
  notes: string;
}

/* ── Avatar helpers ────────────────────────────────────── */

const AVATAR_COLORS = [
  'bg-secondary-container text-on-secondary-container',
  'bg-primary-fixed text-on-primary-fixed',
  'bg-tertiary-fixed text-on-tertiary-fixed',
  'bg-outline-variant text-on-surface-variant',
  'bg-surface-container-high text-on-surface-variant',
];

function getAvatarColor(id: number): string {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';

  // Detect Arabic: if the string contains Arabic letters, take the first two chars
  if (/[\u0600-\u06FF]/.test(trimmed)) {
    return trimmed.slice(0, 2);
  }

  // Latin / other: first letter of first word + first letter of last word
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

/* ── Component ─────────────────────────────────────────── */

export default function CustomersPage() {
  const { t, currency } = useTranslation();
  const session = JSON.parse(localStorage.getItem('session') || '{}');
  const { activeBranchId } = useActiveBranch();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  /* Order history state */
  const [orderHistoryCustomer, setOrderHistoryCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>();

  /* ── Data fetching ── */

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await window.electronAPI.customers.getAll(activeBranchId);
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  }, [activeBranchId]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  /* ── Search ── */

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (searchQuery.trim()) {
        try {
          const results = await window.electronAPI.customers.search(searchQuery.trim(), activeBranchId);
          setCustomers(results || []);
        } catch (err) {
          console.error('Search failed:', err);
        }
      } else {
        loadCustomers();
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery, loadCustomers, activeBranchId]);

  /* ── Modal helpers ── */

  const openAddModal = () => {
    setEditingCustomer(null);
    reset({ name: '', phone: '', notes: '' });
    setModalOpen(true);
  };

  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    reset({ name: customer.name, phone: customer.phone || '', notes: customer.notes || '' });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCustomer(null);
    reset({ name: '', phone: '', notes: '' });
  };

  /* ── Form submit ── */

  const onSubmit = async (data: CustomerFormValues) => {
    try {
      if (editingCustomer) {
        await window.electronAPI.customers.update(editingCustomer.id, {
          name: data.name,
          phone: data.phone,
          notes: data.notes,
        });
      } else {
        await window.electronAPI.customers.create({
          name: data.name,
          phone: data.phone,
          notes: data.notes,
          branch_id: activeBranchId,
        });
      }
      closeModal();
      await loadCustomers();
    } catch (err) {
      console.error('Failed to save customer:', err);
    }
  };

  /* ── Delete ── */

  const handleDelete = async (customer: Customer) => {
    if (!window.confirm(t('Delete customer "{name}"? This action cannot be undone.').replace('{name}', customer.name))) return;
    try {
      await window.electronAPI.customers.delete(customer.id);
      await loadCustomers();
    } catch (err) {
      console.error('Failed to delete customer:', err);
    }
  };

  /* ── Order history ── */

  const viewOrderHistory = async (customer: Customer) => {
    setOrderHistoryCustomer(customer);
    setLoadingOrders(true);
    try {
      const orders = await window.electronAPI.customers.getOrders(customer.id);
      setCustomerOrders(orders || []);
    } catch (err) {
      console.error('Failed to load customer orders:', err);
      setCustomerOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  const closeOrderHistory = () => {
    setOrderHistoryCustomer(null);
    setCustomerOrders([]);
  };

  /* ── Render ── */

  return (
    <div className="space-y-10">
      {/* ── Header ── */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-headline font-extrabold text-on-surface tracking-tight">
            {t('Customers')}
          </h1>
          <p className="text-secondary mt-1 text-sm">
            {t("Manage your boutique's client profiles and preferences.")}
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary flex items-center gap-2 py-4 px-10 text-sm shadow-xl hover:opacity-90 transition-opacity active:scale-95"
        >
          <span className="material-symbols-outlined">person_add</span>
          {t('Add Customer')}
        </button>
      </div>

      {/* ── Search ── */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-secondary uppercase tracking-widest mb-2 block">
            {t('Quick Search')}
          </label>
          <div className="relative group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-12"
              placeholder={t('Search by name, phone, or tags...')}
            />
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
              search
            </span>
          </div>
        </div>
      </div>

      {/* ── Customer Table ── */}
      <div className="bg-surface-container-lowest overflow-x-auto rounded-xl">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-secondary">
            <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
            {t('Loading customers...')}
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-secondary">
            <span className="material-symbols-outlined text-5xl mb-3 text-outline">group</span>
            <p className="font-headline font-bold text-on-surface text-lg">{t('No customers found')}</p>
            <p className="text-sm mt-1">
              {searchQuery ? t('Try a different search term.') : t('Add your first customer to get started.')}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('Name / Client')}</th>
                <th>{t('Phone Number')}</th>
                <th>{t('Notes & Preferences')}</th>
                <th className="text-right">{t('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  {/* Name + Avatar */}
                  <td>
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${getAvatarColor(customer.id)}`}
                      >
                        {getInitials(customer.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-headline font-bold text-on-surface truncate">
                          {customer.name}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Phone */}
                  <td>
                    {customer.phone ? (
                      <span className="text-base font-headline font-bold text-primary tracking-tight">
                        {customer.phone}
                      </span>
                    ) : (
                      <span className="text-outline text-sm">--</span>
                    )}
                  </td>

                  {/* Notes */}
                  <td className="max-w-md">
                    {customer.notes ? (
                      <p className="text-secondary text-sm line-clamp-1 italic">
                        {customer.notes}
                      </p>
                    ) : (
                      <span className="text-outline text-sm">{t('No notes')}</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => viewOrderHistory(customer)}
                        className="p-2 text-outline hover:text-primary transition-colors"
                        title={t('Order History')}
                      >
                        <span className="material-symbols-outlined">receipt_long</span>
                      </button>
                      <button
                        onClick={() => openEditModal(customer)}
                        className="p-2 text-outline hover:text-primary transition-colors"
                        title={t('Edit customer')}
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(customer)}
                        className="p-2 text-outline hover:text-error transition-colors"
                        title={t('Delete customer')}
                      >
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Table Footer */}
        {customers.length > 0 && (
          <div className="px-6 py-4 border-t border-surface-container-high text-sm text-secondary">
            {t('Showing {count} customer(s)').replace('{count}', String(customers.length))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Modal ── */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="flex min-h-full items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-6 md:px-8 md:py-10">
                {/* Modal Header */}
                <div className="flex justify-between items-start mb-10">
                  <div>
                    <h2 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
                      {editingCustomer ? t('Edit Client Profile') : t('New Client Profile')}
                    </h2>
                    <p className="text-secondary text-sm mt-1">
                      {editingCustomer
                        ? t('Update customer information in the database.')
                        : t('Add a new customer to the Etiquette Studio database.')}
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="p-2 text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
                  {/* Name */}
                  <div className="relative">
                    <label className="absolute -top-2 left-4 px-1 bg-surface-container-lowest text-xs font-semibold text-secondary uppercase tracking-widest z-10">
                      {t('Full Name')}
                    </label>
                    <input
                      {...register('name', { required: t('Name is required') })}
                      type="text"
                      className={`input-field ${errors.name ? 'border-b-error' : ''}`}
                      placeholder={t('e.g. Abdullah Ahmed / عبدالله أحمد')}
                    />
                    {errors.name && (
                      <p className="text-error text-xs mt-1 ml-4">{errors.name.message}</p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="relative">
                    <label className="absolute -top-2 left-4 px-1 bg-surface-container-lowest text-xs font-semibold text-secondary uppercase tracking-widest z-10">
                      {t('Phone Number')}
                    </label>
                    <input
                      {...register('phone')}
                      type="tel"
                      className="input-field"
                      placeholder={t('+971 -- --- ----')}
                    />
                  </div>

                  {/* Notes */}
                  <div className="relative">
                    <label className="absolute -top-2 left-4 px-1 bg-surface-container-lowest text-xs font-semibold text-secondary uppercase tracking-widest z-10">
                      {t('Tailoring Notes & Preferences')}
                    </label>
                    <textarea
                      {...register('notes')}
                      rows={5}
                      className="input-field h-auto py-4 pt-6 resize-none"
                      placeholder={t('Fabric choices, measurement quirks, style preferences...')}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-8 py-4 text-sm font-semibold text-secondary hover:text-on-surface transition-colors"
                    >
                      {t('Cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="btn-primary px-10 py-4 text-sm shadow-xl active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isSubmitting
                        ? t('Saving...')
                        : editingCustomer
                          ? t('Update Profile')
                          : t('Create Profile')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Order History Modal ── */}
      {orderHistoryCustomer && (
        <div className="modal-backdrop" onClick={closeOrderHistory}>
          <div className="flex min-h-full items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
              <div className="px-4 py-6 md:px-8 md:py-10">
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-headline font-extrabold text-on-surface tracking-tight">
                      {t('Order History')}
                    </h2>
                    <p className="text-secondary text-sm mt-1">
                      {orderHistoryCustomer.name} {orderHistoryCustomer.phone ? `• ${orderHistoryCustomer.phone}` : ''}
                    </p>
                  </div>
                  <button onClick={closeOrderHistory} className="p-2 text-outline hover:text-on-surface transition-colors">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Summary */}
                {!loadingOrders && customerOrders.length > 0 && (
                  <div className="flex gap-4 mb-6">
                    <div className="flex-1 bg-surface-container-low rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{t('Total Orders')}</p>
                      <p className="text-2xl font-headline font-extrabold text-on-surface mt-1">{customerOrders.length}</p>
                    </div>
                    <div className="flex-1 bg-error-container/30 rounded-xl p-4 text-center">
                      <p className="text-xs font-semibold uppercase tracking-widest text-secondary">{t('Total Outstanding')}</p>
                      <p className="text-2xl font-headline font-extrabold text-error mt-1">
                        {customerOrders.reduce((s: number, o: any) => s + (o.balance || 0), 0).toFixed(2)} {t(currency)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Orders table */}
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-12 text-secondary">
                    <span className="material-symbols-outlined animate-spin mr-2">progress_activity</span>
                    {t('Loading...')}
                  </div>
                ) : customerOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-secondary">
                    <span className="material-symbols-outlined text-4xl mb-2 text-outline">receipt_long</span>
                    <p className="font-headline font-bold text-on-surface">{t('No orders found')}</p>
                  </div>
                ) : (
                  <div className="bg-surface-container-low rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left">
                      <thead className="bg-surface-container-high sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary">{t('Order')}</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary">{t('Item')}</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary">{t('Status')}</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary text-right">{t('Price')}</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary text-right">{t('Paid')}</th>
                          <th className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-secondary text-right">{t('Balance')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map((order: any) => (
                          <tr
                            key={order.id}
                            className={`border-t border-outline-variant/20 ${order.balance > 0 ? 'bg-error-container/10' : ''}`}
                          >
                            <td className="px-4 py-2 text-sm font-mono font-bold text-primary">{order.order_number}</td>
                            <td className="px-4 py-2 text-sm text-secondary">{order.piece_type}</td>
                            <td className="px-4 py-2"><span className="chip chip-progress">{order.status}</span></td>
                            <td className="px-4 py-2 text-right text-sm">{Number(order.price).toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-sm">{Number(order.paid).toFixed(2)}</td>
                            <td className={`px-4 py-2 text-right text-sm font-bold ${order.balance > 0 ? 'text-error' : 'text-tertiary'}`}>
                              {Number(order.balance).toFixed(2)} {t(currency)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Close button */}
                <div className="flex justify-end pt-6">
                  <button
                    onClick={closeOrderHistory}
                    className="px-8 py-3 text-sm font-semibold text-secondary hover:text-on-surface transition-colors"
                  >
                    {t('Close')}
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
