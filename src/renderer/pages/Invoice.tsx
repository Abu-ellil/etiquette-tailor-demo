import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/I18nContext';

interface OrderItem {
  piece_type: string;
  piece_type_ar?: string;
  details?: string;
  price: number;
  quantity?: number;
}

interface OrderData {
  id: number;
  order_number: string;
  customer_name: string;
  customer_name_ar?: string;
  customer_phone?: string;
  created_at: string;
  due_date: string;
  receive_date?: string;
  delivery_date?: string;
  piece_type: string;
  details?: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  balance: number;
  payment_method: string;
  status: string;
  worker_name?: string;
}

interface ShopSettings {
  shop_name_ar?: string;
  shop_name_en?: string;
  shop_phone?: string;
  receipt_footer?: string;
  invoice_header_text?: string;
  invoice_shop_name_ar?: string;
  invoice_shop_name_en?: string;
  invoice_section_order?: string;
  invoice_show_shop_name?: string;
  invoice_show_branch_info?: string;
  invoice_show_phone?: string;
  invoice_show_worker_name?: string;
  invoice_show_worker_phone?: string;
  invoice_show_delivery_date?: string;
  invoice_show_payment_method?: string;
  invoice_show_shop_logo?: string;
  invoice_show_notes?: string;
}

interface BranchInfo {
  name_ar: string;
  name_en: string;
  prefix: string;
  address?: string;
  phone?: string;
}

const DEFAULT_SECTION_ORDER = [
  'shop_logo', 'shop_name', 'branch_info', 'phone',
  'invoice_details', 'worker_name', 'items', 'totals', 'previous_balance',
  'payment_method', 'dates', 'payment_status', 'notes', 'footer',
];

function formatShortDate(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function ReceiptRow({ value, label, bold }: { value: string; label: string; bold?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className={`${bold ? 'font-bold' : ''} text-left`}>{value}</span>
      <span className={`${bold ? 'font-bold' : ''} text-right text-gray-700 whitespace-nowrap`}>{label}</span>
    </div>
  );
}

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, currency } = useTranslation();
  const [order, setOrder] = useState<OrderData | null>(null);
  const [settings, setSettings] = useState<ShopSettings>({});
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [previousBalance, setPreviousBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [settingsData, orderData] = await Promise.all([
          window.electronAPI?.settings?.getAll?.() || {},
          id ? window.electronAPI?.orders?.get?.(Number(id)) : null,
        ]);

        setSettings(settingsData || {});

        if (orderData) {
          const total = orderData.price ?? orderData.total ?? 0;
          const paid = orderData.paid ?? 0;
          const balance = total - paid;

          let items: OrderItem[] = [];
          try {
            const orderItems = await window.electronAPI?.orders?.getItems?.(orderData.id);
            if (orderItems && orderItems.length > 0) {
              items = orderItems.map((it: any) => ({
                piece_type: it.piece_type || '',
                price: it.total_price || it.unit_price || 0,
                quantity: it.quantity || 1,
              }));
            }
          } catch { /* items fetch failed */ }

          if (items.length === 0) {
            items = [{ piece_type: orderData.piece_type || 'Tailoring Service', price: total }];
          }

          let workerName: string | undefined;
          try {
            const tasks = await window.electronAPI?.orders?.getTasks?.(orderData.id);
            if (tasks && tasks.length > 0) {
              const workerNames = tasks
                .filter((task: any) => task.assigned_to_name || task.worker_name)
                .map((task: any) => task.assigned_to_name || task.worker_name);
              if (workerNames.length > 0) {
                workerName = [...new Set(workerNames)].join(' - ');
              }
            }
          } catch { /* tasks fetch failed */ }

          setOrder({
            id: orderData.id,
            order_number: orderData.order_number || `${String(orderData.id).padStart(4, '0')}`,
            customer_name: orderData.customer_name || orderData.customerName || '',
            customer_name_ar: orderData.customer_name_ar || '',
            customer_phone: orderData.customer_phone || orderData.customerPhone || orderData.phone || '',
            created_at: orderData.created_at || orderData.createdAt || '',
            due_date: orderData.due_date || orderData.dueDate || orderData.delivery_date || '',
            receive_date: orderData.receive_date || '',
            delivery_date: orderData.delivery_date || orderData.due_date || orderData.dueDate || '',
            piece_type: orderData.piece_type || orderData.pieceType || '',
            details: orderData.details || '',
            items,
            subtotal: total,
            discount: orderData.discount ?? 0,
            total,
            paid,
            balance,
            payment_method: orderData.payment_method || orderData.paymentMethod || 'cash',
            status: orderData.status || 'intake',
            worker_name: workerName,
          });

          // Set branch info from order data (already fetched with branch details)
          if (orderData.branch_id) {
            setBranch({
              name_ar: orderData.branch_name_ar || '',
              name_en: orderData.branch_name || '',
              prefix: orderData.branch_prefix || '',
              address: orderData.branch_address || '',
              phone: orderData.branch_phone || '',
            });
          }

          // Fetch previous outstanding balance (from other orders)
          if (orderData.customer_id) {
            try {
              const outstandingOrders = await window.electronAPI?.customers?.getOutstandingOrders?.(orderData.customer_id);
              if (outstandingOrders && outstandingOrders.length > 0) {
                const prevBal = outstandingOrders
                  .filter((o: any) => o.id !== orderData.id)
                  .reduce((sum: number, o: any) => sum + (Number(o.balance) || 0), 0);
                setPreviousBalance(prevBal);
              }
            } catch { /* outstanding fetch failed */ }
          }
        }
      } catch { /* order not found */ }
      setOrder(prev => prev);
      setLoading(false);
    }
    fetchData();
  }, [id]);

  const handlePrint = () => window.electronAPI?.print?.receipt?.();

  const handleDelete = async () => {
    if (!confirm(t('Delete invoice {number}? This cannot be undone.').replace('{number}', order.order_number))) return;
    try {
      await window.electronAPI.orders.delete(order.id);
      navigate('/orders');
    } catch (err) {
      console.error('Failed to delete invoice:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-secondary">{t('Loading invoice...')}</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <span className="material-symbols-outlined text-5xl text-error">receipt_long</span>
        <p className="text-secondary">{t('Order not found.')}</p>
        <button onClick={() => navigate(-1)} className="btn-primary text-sm">{t('Go Back')}</button>
      </div>
    );
  }

  // Invoice-specific shop name (fallback to global)
  const shopNameAr = settings.invoice_shop_name_ar || settings.shop_name_ar || 'إتيكيت تيلور';
  const shopNameEn = settings.invoice_shop_name_en || settings.shop_name_en || 'Etiquette Tailor';
  const shopPhone = settings.shop_phone || '';
  const receiptFooter = settings.receipt_footer || '';
  const invoiceHeaderText = settings.invoice_header_text || '';
  const isPaid = order.balance <= 0;

  // Visibility toggles
  const showShopName = settings.invoice_show_shop_name !== '0';
  const showBranchInfo = settings.invoice_show_branch_info !== '0';
  const showPhone = settings.invoice_show_phone !== '0';
  const showWorkerName = settings.invoice_show_worker_name !== '0';
  const showDeliveryDate = settings.invoice_show_delivery_date !== '0';
  const showPaymentMethod = settings.invoice_show_payment_method !== '0';
  const showShopLogo = settings.invoice_show_shop_logo !== '0';
  const showNotes = settings.invoice_show_notes !== '0';

  // Section order
  let sectionOrder: string[];
  try {
    const parsed = settings.invoice_section_order ? JSON.parse(settings.invoice_section_order) : null;
    sectionOrder = Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_SECTION_ORDER;
  } catch {
    sectionOrder = DEFAULT_SECTION_ORDER;
  }

  // Section renderers
  const sectionRenderers: Record<string, React.ReactNode> = {
    shop_logo: showShopLogo ? (
      <div key="shop_logo" className="text-center mb-2">
        <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>styler</span>
      </div>
    ) : null,

    shop_name: showShopName ? (
      <div key="shop_name" className="text-center mb-3">
        <div className="text-xl font-bold mb-0.5">{shopNameAr}</div>
        <div className="text-[10px] text-gray-600">{shopNameEn}</div>
        {invoiceHeaderText && <div className="text-[10px] text-gray-500 mt-0.5">{invoiceHeaderText}</div>}
      </div>
    ) : null,

    branch_info: (showBranchInfo && branch) ? (
      <div key="branch_info" className="text-center mb-3">
        <div className="text-[10px] text-gray-600">
          {t('Branch')} {branch.prefix} — {branch.name_ar} / {branch.name_en}
        </div>
      </div>
    ) : null,

    phone: (showPhone && (branch?.phone || shopPhone)) ? (
      <div key="phone" className="text-center mb-3">
        <div className="text-[11px]">{branch?.phone || shopPhone}</div>
      </div>
    ) : null,

    invoice_details: (
      <div key="invoice_details" className="space-y-1">
        <ReceiptRow value={order.order_number} label={t('Invoice Number / رقم الفاتورة')} />
        <ReceiptRow value={order.customer_phone || order.customer_name} label={t('Phone / الهاتف')} />
      </div>
    ),

    worker_name: (showWorkerName && order.worker_name) ? (
      <div key="worker_name" className="space-y-1">
        <ReceiptRow value={order.worker_name} label={t('Worker / العامل')} />
      </div>
    ) : null,

    items: (
      <div key="items" className="space-y-1">
        {order.items.map((item, idx) => (
          <div key={idx}>
            <ReceiptRow
              value={item.piece_type}
              label={item.quantity && item.quantity > 1
                ? `${t('Service')} (${item.quantity}x)`
                : t('Service / الخدمة')}
            />
            <ReceiptRow
              value={`${formatCurrency(item.price)} ${t(currency)}`}
              label={t('Price / السعر')}
            />
          </div>
        ))}
      </div>
    ),

    totals: (
      <div key="totals" className="space-y-1">
        <ReceiptRow value={`${formatCurrency(order.total)} ${t(currency)}`} label={t('Total / الإجمالي')} bold />
        <ReceiptRow value={`${formatCurrency(order.paid)} ${t(currency)}`} label={t('Paid / المدفوع')} />
        {order.balance > 0 && (
          <ReceiptRow value={`${formatCurrency(order.balance)} ${t(currency)}`} label={t('Balance Due / الرصيد')} bold />
        )}
      </div>
    ),

    previous_balance: previousBalance > 0 ? (
      <div key="previous_balance" className="my-1">
        <div className="border-t border-dotted border-gray-300 mb-1" />
        <div className="text-center text-[10px] text-gray-500 mb-1">
          {t('Previous Orders Balance')}
        </div>
        <ReceiptRow
          value={`${formatCurrency(previousBalance)} ${t(currency)}`}
          label={t('Due / المستحق')}
          bold
        />
        <ReceiptRow
          value={`${formatCurrency(order.total + previousBalance)} ${t(currency)}`}
          label={t('Grand Total / المجموع')}
          bold
        />
      </div>
    ) : null,

    payment_method: showPaymentMethod ? (
      <div key="payment_method" className="space-y-1">
        <ReceiptRow
          value={order.payment_method === 'card' ? t('Card') : t('Cash')}
          label={t('Payment / الدفع')}
        />
      </div>
    ) : null,

    dates: (
      <div key="dates" className="space-y-1">
        <ReceiptRow value={formatShortDate(order.created_at)} label={t('Receipt Date / تاريخ')} />
        {showDeliveryDate && order.delivery_date && (
          <ReceiptRow value={formatShortDate(order.delivery_date)} label={t('Delivery Date / التسليم')} />
        )}
      </div>
    ),

    payment_status: (
      <div key="payment_status" className="text-center mb-2">
        {isPaid ? (
          <div className="font-bold">{t('Paid in Full / تم الدفع')}</div>
        ) : (
          <div className="font-bold">
            {t('Balance Due / الرصيد المتبقي')}: {formatCurrency(order.balance)} {t(currency)}
          </div>
        )}
      </div>
    ),

    notes: showNotes ? (
      <div key="notes" className="text-[9px] text-gray-500 leading-tight my-2">
        <div dir="rtl" className="text-right mb-1">
          ملاحظة: المحل غير مسؤول عن تعديل طلبكم بعد استلامه بـ 7 أيام عمل وعن طلباتكم الغير المستلمة بعد 30 يوماً من تاريخ تسليم الطلب
        </div>
        <div dir="ltr" className="text-left">
          Note: The shop is not responsible for any modifications to your order after 7 working days from the date of receipt, and is not responsible for uncollected orders after 30 days from the delivery date.
        </div>
      </div>
    ) : null,

    footer: (
      <div key="footer" className="text-center text-[10px] text-gray-600 space-y-1">
        <div className="font-bold text-[11px]">{t('Thank you for your trust!')}</div>
        {shopPhone && <div>{t('For inquiries')} : {shopPhone}</div>}
        {receiptFooter && <div className="mt-1">{receiptFooter}</div>}
      </div>
    ),
  };

  // Build ordered sections with dividers between visible ones
  const visibleSections = sectionOrder
    .map(key => sectionRenderers[key])
    .filter(Boolean);

  return (
    <div className="pb-12">
      {/* Action Toolbar */}
      <div className="no-print w-full max-w-[400px] mx-auto mb-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-surface-container rounded-full transition-colors"
            onClick={() => navigate(-1)}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 className="font-headline text-xl font-bold">{t('Preview Invoice')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-error/10 rounded-lg text-secondary hover:text-error transition-colors"
            onClick={handleDelete}
            title={t('Delete Invoice')}
          >
            <span className="material-symbols-outlined">delete</span>
          </button>
          <button
            className="flex items-center gap-2 bg-primary text-white px-5 py-2 rounded-md hover:opacity-90 transition-opacity"
            onClick={() => handlePrint()}
          >
            <span className="material-symbols-outlined text-sm">print</span>
            <span className="text-sm font-semibold">{t('Print Receipt')}</span>
          </button>
        </div>
      </div>

      {/* Thermal Receipt */}
      <div className="flex justify-center">
        <div
          className="thermal-receipt w-full max-w-[302px] bg-white text-black p-4 font-mono text-[12px] leading-relaxed"
          style={{ fontFamily: "'Courier New', 'Lucida Console', monospace" }}
        >
          {visibleSections.map((section, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <div className="border-t border-dashed border-gray-400 my-2" />}
              {section}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
