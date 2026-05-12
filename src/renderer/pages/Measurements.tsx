import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import { useTranslation } from '../contexts/I18nContext';

// --- Types ---

interface Customer {
  id: number;
  name: string;
  phone?: string;
  notes?: string;
  branch_id: number;
  created_at?: string;
}

interface Order {
  id: number;
  order_number: string;
  customer_id: number;
  status: string;
  created_at?: string;
}

interface MeasurementsData {
  chest: string;
  waist: string;
  hips: string;
  length: string;
  sleeve: string;
  shoulder: string;
  notes: string;
}

interface CustomerProfile {
  customer: Customer;
  orderCount: number;
  lastVisit: string | null;
}

// --- Measurement field groups (labels set inside component via t()) ---

// --- Component ---

export default function MeasurementsPage() {
  const { t } = useTranslation();

  const UPPER_BODY_FIELDS: { key: keyof MeasurementsData; label: string }[] = [
    { key: 'chest', label: t('Chest (Circumference)') },
    { key: 'waist', label: t('Waist (True Waist)') },
    { key: 'hips', label: t('Hips') },
    { key: 'shoulder', label: t('Shoulder Width') },
  ];

  const LENGTHS_FIELDS: { key: keyof MeasurementsData; label: string }[] = [
    { key: 'sleeve', label: t('Sleeve') },
    { key: 'length', label: t('Total Garment Length') },
  ];

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const {
    register,
    reset,
    handleSubmit,
    formState: { isDirty },
  } = useForm<MeasurementsData>({
    defaultValues: {
      chest: '',
      waist: '',
      hips: '',
      length: '',
      sleeve: '',
      shoulder: '',
      notes: '',
    },
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load all customers on mount
  useEffect(() => {
    window.electronAPI.customers.getAll().then((data: Customer[]) => {
      setCustomers(data);
    });
  }, []);

  // Search customers when query changes
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      window.electronAPI.customers.getAll().then((data: Customer[]) => {
        setCustomers(data);
      });
      return;
    }
    const timer = setTimeout(() => {
      window.electronAPI.customers.search(searchQuery).then((data: Customer[]) => {
        setCustomers(data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load customer profile when selected
  const loadCustomerProfile = useCallback(async (customer: Customer) => {
    try {
      const orders: Order[] = await window.electronAPI.orders.getAll();
      const customerOrders = orders.filter((o) => o.customer_id === customer.id);
      const lastOrder = customerOrders.length > 0 ? customerOrders[0] : null;

      setCustomerProfile({
        customer,
        orderCount: customerOrders.length,
        lastVisit: lastOrder?.created_at || null,
      });

      // Try to load measurements from the most recent order
      if (lastOrder) {
        const measurements = await window.electronAPI.orders.getMeasurements(lastOrder.id);
        if (measurements) {
          reset({
            chest: measurements.chest != null ? String(measurements.chest) : '',
            waist: measurements.waist != null ? String(measurements.waist) : '',
            hips: measurements.hips != null ? String(measurements.hips) : '',
            length: measurements.length != null ? String(measurements.length) : '',
            sleeve: measurements.sleeve != null ? String(measurements.sleeve) : '',
            shoulder: measurements.shoulder != null ? String(measurements.shoulder) : '',
            notes: measurements.notes || '',
          });
          return;
        }
      }
      // No order or no measurements -- reset form
      reset({ chest: '', waist: '', hips: '', length: '', sleeve: '', shoulder: '', notes: '' });
    } catch {
      setCustomerProfile(null);
      reset({ chest: '', waist: '', hips: '', length: '', sleeve: '', shoulder: '', notes: '' });
    }
  }, [reset]);

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchQuery(customer.name);
    setShowDropdown(false);
    setSaveMessage(null);
    loadCustomerProfile(customer);
  };

  const onSubmit = async (data: MeasurementsData) => {
    if (!selectedCustomer || !customerProfile) return;

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Find the customer's most recent order to save measurements against
      const orders: Order[] = await window.electronAPI.orders.getAll();
      const customerOrders = orders.filter((o) => o.customer_id === selectedCustomer.id);

      if (customerOrders.length === 0) {
        setSaveMessage({ type: 'error', text: t('No orders for this customer. Create an order first.') });
        setIsSaving(false);
        return;
      }

      const latestOrder = customerOrders[0];
      const parsedData = {
        chest: data.chest ? parseFloat(data.chest) : null,
        waist: data.waist ? parseFloat(data.waist) : null,
        hips: data.hips ? parseFloat(data.hips) : null,
        length: data.length ? parseFloat(data.length) : null,
        sleeve: data.sleeve ? parseFloat(data.sleeve) : null,
        shoulder: data.shoulder ? parseFloat(data.shoulder) : null,
        notes: data.notes || null,
      };

      await window.electronAPI.orders.updateMeasurements(latestOrder.id, parsedData);
      setSaveMessage({ type: 'success', text: t('Measurements saved successfully.') });
    } catch {
      setSaveMessage({ type: 'error', text: t('Failed to save measurements.') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (selectedCustomer && customerProfile) {
      loadCustomerProfile(selectedCustomer);
    } else {
      reset({ chest: '', waist: '', hips: '', length: '', sleeve: '', shoulder: '', notes: '' });
    }
    setSaveMessage(null);
  };

  return (
    <div className="space-y-16">
      {/* Header & Customer Selector */}
      <header>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-2">
            <p className="text-secondary font-semibold tracking-[0.2em] uppercase text-xs">
              {t('ATELIER RECORDS')}
            </p>
            <h2 className="text-5xl font-extrabold font-headline tracking-tight text-on-surface">
              {t('Measurements')}
            </h2>
          </div>

          {/* Customer Selector */}
          <div className="relative w-full max-w-md" ref={searchRef}>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-2 ml-1">
              {t('Select Client')}
            </label>
            <div className="group relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-secondary">
                person_search
              </span>
              <input
                className="w-full h-14 pl-12 pr-4 bg-surface-container-high border-none border-b-2 border-transparent focus:border-primary focus:outline-none rounded-t-lg font-[family-name:var(--font-inter)] text-on-surface font-medium transition-colors"
                placeholder={t('Search customer by name or phone...')}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <span
                  className="material-symbols-outlined text-primary cursor-pointer"
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  expand_more
                </span>
              </div>
            </div>

            {/* Dropdown */}
            {showDropdown && customers.length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.12)] border border-outline-variant/10 max-h-64 overflow-y-auto">
                {customers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-surface-container-high transition-colors flex items-center gap-3 first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <span className="material-symbols-outlined text-secondary text-xl">person</span>
                    <div>
                      <p className="text-sm font-semibold text-on-surface">{customer.name}</p>
                      {customer.phone && (
                        <p className="text-xs text-secondary">{customer.phone}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showDropdown && customers.length === 0 && searchQuery.trim().length > 0 && (
              <div className="absolute z-50 mt-1 w-full bg-surface-container-lowest rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.12)] border border-outline-variant/10 p-4">
                <p className="text-sm text-secondary text-center">{t('No customers found')}</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Two-column content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Measurement Form Column */}
        <div className="lg:col-span-8 space-y-16">
          {!selectedCustomer ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <span className="material-symbols-outlined text-6xl text-surface-container-highest mb-4">
                straighten
              </span>
              <p className="text-lg font-semibold text-secondary">{t('Select a client to view measurements')}</p>
              <p className="text-sm text-surface-container-highest mt-1">
                {t('Use the search bar above to find a customer')}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-16">
              {/* Upper Body Section */}
              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-2xl font-bold font-headline text-on-surface">{t('Upper Body')}</h3>
                  <div className="h-[2px] flex-1 bg-surface-container-highest" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  {UPPER_BODY_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-secondary font-semibold uppercase tracking-wider text-[11px]">
                        {field.label}
                      </label>
                      <input
                        {...register(field.key)}
                        className="w-full h-14 bg-surface-container-high border-none border-b-2 border-transparent focus:border-primary focus:outline-none rounded-t-lg px-4 text-lg transition-colors"
                        type="text"
                        placeholder={t('e.g. 38.5"')}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Lengths & Sleeves Section */}
              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-2xl font-bold font-headline text-on-surface">{t('Lengths & Sleeves')}</h3>
                  <div className="h-[2px] flex-1 bg-surface-container-highest" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
                  {LENGTHS_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-secondary font-semibold uppercase tracking-wider text-[11px]">
                        {field.label}
                      </label>
                      <input
                        {...register(field.key)}
                        className="w-full h-14 bg-surface-container-high border-none border-b-2 border-transparent focus:border-primary focus:outline-none rounded-t-lg px-4 text-lg transition-colors"
                        type="text"
                        placeholder={t('e.g. 24.5"')}
                      />
                    </div>
                  ))}
                </div>
              </section>

              {/* Custom Annotations Section */}
              <section>
                <div className="flex items-center gap-4 mb-8">
                  <h3 className="text-2xl font-bold font-headline text-on-surface">{t('Custom Annotations')}</h3>
                  <div className="h-[2px] flex-1 bg-surface-container-highest" />
                </div>
                <div className="space-y-1">
                  <label className="block text-secondary font-semibold uppercase tracking-wider text-[11px]">
                    {t('Specific Client Requirements')}
                  </label>
                  <textarea
                    {...register('notes')}
                    className="w-full bg-surface-container-high border-none border-b-2 border-transparent focus:border-primary focus:outline-none rounded-t-lg p-4 text-base resize-none transition-colors"
                    placeholder={t('Enter posture notes, fabric preference, or unique fit requirements...')}
                    rows={4}
                  />
                </div>
              </section>

              {/* Save message */}
              {saveMessage && (
                <div
                  className={`flex items-center gap-3 p-4 rounded-xl ${
                    saveMessage.type === 'success'
                      ? 'bg-tertiary-fixed/30 text-on-tertiary-fixed'
                      : 'bg-error-container text-on-error-container'
                  }`}
                >
                  <span className="material-symbols-outlined">
                    {saveMessage.type === 'success' ? 'check_circle' : 'error'}
                  </span>
                  <p className="text-sm font-medium">{saveMessage.text}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-6 pt-8">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={!isDirty && !saveMessage}
                  className="px-8 py-4 text-primary font-bold tracking-wide uppercase hover:bg-primary-container/10 transition-colors rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {t('Reset Changes')}
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !selectedCustomer}
                  className="px-12 py-4 bg-gradient-to-r from-primary to-primary-container text-white font-bold tracking-widest uppercase rounded-md shadow-[0px_10px_25px_rgba(118,57,82,0.25)] hover:translate-y-[-2px] active:translate-y-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-3"
                >
                  {isSaving ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      {t('Saving...')}
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-lg">save</span>
                      {t('Update Record')}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Profile Summary / Status Column */}
        <div className="lg:col-span-4">
          <div className="sticky top-12 space-y-8">
            {selectedCustomer && customerProfile ? (
              <>
                {/* Client Card */}
                <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.06)] border border-outline-variant/10">
                  {/* Avatar */}
                  <div className="flex justify-center mb-6">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-surface-container bg-primary-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                        person
                      </span>
                    </div>
                  </div>

                  {/* Name & ID */}
                  <div className="text-center space-y-1 mb-8">
                    <h4 className="text-xl font-bold font-headline text-on-surface">
                      {customerProfile.customer.name}
                    </h4>
                    <p className="text-sm text-secondary">
                      {t('ID #')}{String(customerProfile.customer.id).padStart(4, '0')}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-3 border-b border-surface-container">
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary">{t('Phone')}</span>
                      <span className="text-sm font-medium text-on-surface">
                        {customerProfile.customer.phone || '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-surface-container">
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary">{t('Total Orders')}</span>
                      <span className="text-sm font-medium text-on-surface">
                        {customerProfile.orderCount}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 border-b border-surface-container">
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary">{t('Last Visit')}</span>
                      <span className="text-sm font-medium text-on-surface">
                        {customerProfile.lastVisit
                          ? format(new Date(customerProfile.lastVisit), 'MMM d, yyyy')
                          : '--'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-secondary">{t('Record Status')}</span>
                      <span className="px-3 py-1 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold uppercase tracking-widest rounded-full">
                        {t('Ready')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Helpful Tip */}
                <div className="bg-primary-container p-8 rounded-xl text-white">
                  <span className="material-symbols-outlined mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
                  <h5 className="text-lg font-bold font-headline mb-2 leading-tight">{t('How to take accurate measurements')}</h5>
                  <p className="text-sm opacity-90 leading-relaxed">
                    {t('Ensure the client stands naturally. Measurements should be snug but not tight. Record measurements in inches for best accuracy.')}
                  </p>
                </div>
              </>
            ) : (
              /* Empty state for profile column */
              <div className="bg-surface-container-lowest p-8 rounded-xl shadow-[0px_20px_40px_rgba(25,28,29,0.06)] border border-outline-variant/10 text-center">
                <span className="material-symbols-outlined text-5xl text-surface-container-highest mb-3">
                  person_search
                </span>
                <p className="text-sm text-secondary">{t('Select a client to view their profile and measurements')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
