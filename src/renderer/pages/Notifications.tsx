import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../contexts/I18nContext';

interface Session {
  userId: number;
  role: string;
  [key: string]: any;
}

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  message: string;
  order_id?: number | null;
  task_id?: number | null;
  is_read: number;
  created_at?: string;
  order_number?: string;
}

const TYPE_ICONS: Record<string, string> = {
  order_created: 'add_shopping_cart',
  order_status_changed: 'swap_horiz',
  order_overdue: 'warning',
  payment_received: 'payments',
  task_status_changed: 'task_alt',
};

const TYPE_COLORS: Record<string, string> = {
  order_created: 'text-primary',
  order_status_changed: 'text-on-primary-fixed-variant',
  order_overdue: 'text-error',
  payment_received: 'text-tertiary',
  task_status_changed: 'text-on-tertiary-fixed-variant',
};

const TYPE_LABELS: Record<string, string> = {
  order_created: 'Order Created',
  order_status_changed: 'Status Changed',
  order_overdue: 'Overdue',
  payment_received: 'Payment',
  task_status_changed: 'Task Update',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Get session from localStorage (same pattern as other pages)
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('session');
    if (stored) {
      try {
        setSession(JSON.parse(stored));
      } catch {
        navigate('/login');
      }
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const loadNotifications = useCallback(async () => {
    if (!session?.userId) return;
    setLoading(true);
    try {
      const notifs = await window.electronAPI.notifications.getForUser(
        session.userId,
        session.role,
        200
      );
      setNotifications(notifs || []);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  }, [session?.userId, session?.role]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    if (!session) return;
    try {
      await window.electronAPI.notifications.markAllAsRead(session.userId, session.role);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const handleClearRead = async () => {
    if (!session) return;
    try {
      await window.electronAPI.notifications.clearRead(session.userId, session.role);
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (e) {
      console.error('Failed to clear read notifications:', e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await window.electronAPI.notifications.softDelete(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error('Failed to delete notification:', e);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await window.electronAPI.notifications.markAsRead(notif.id);
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, is_read: 1 } : n))
        );
      } catch (e) {
        console.error('Failed to mark as read:', e);
      }
    }
    if (notif.order_id) {
      navigate(`/orders/${notif.order_id}`);
    }
  };

  // Filter logic
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread' && n.is_read) return false;
    if (filter === 'read' && !n.is_read) return false;
    if (typeFilter !== 'all' && n.type !== typeFilter) return false;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const readCount = notifications.filter(n => n.is_read).length;

  const uniqueTypes = [...new Set(notifications.map(n => n.type))];

  if (!session) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-on-surface">{t('Notification Log')}</h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {t('Total')}: {notifications.length} &nbsp;|&nbsp;
            {t('Unread')}: {unreadCount} &nbsp;|&nbsp;
            {t('Read')}: {readCount}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="btn btn-tonal flex items-center gap-1.5 text-sm"
            >
              <span className="material-symbols-outlined text-base">done_all</span>
              {t('Mark all as read')}
            </button>
          )}
          {readCount > 0 && (
            <button
              onClick={handleClearRead}
              className="btn btn-outlined flex items-center gap-1.5 text-sm text-error border-error/40 hover:bg-error/10"
            >
              <span className="material-symbols-outlined text-base">delete_sweep</span>
              {t('Clear read')}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Read status filter */}
        {(['all', 'unread', 'read'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip cursor-pointer transition-colors ${
              filter === f
                ? 'chip-filled bg-primary text-on-primary'
                : 'chip-outlined hover:bg-surface-container-high'
            }`}
          >
            {t(f === 'all' ? 'All' : f === 'unread' ? 'Unread' : 'Read')}
          </button>
        ))}

        <span className="w-px h-6 bg-outline-variant mx-1" />

        {/* Type filter */}
        <button
          onClick={() => setTypeFilter('all')}
          className={`chip cursor-pointer transition-colors ${
            typeFilter === 'all'
              ? 'chip-filled bg-secondary-container text-on-secondary-container'
              : 'chip-outlined hover:bg-surface-container-high'
          }`}
        >
          {t('All Types')}
        </button>
        {uniqueTypes.map(type => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={`chip cursor-pointer transition-colors ${
              typeFilter === type
                ? 'chip-filled bg-secondary-container text-on-secondary-container'
                : 'chip-outlined hover:bg-surface-container-high'
            }`}
          >
            {t(TYPE_LABELS[type] || type)}
          </button>
        ))}
      </div>

      {/* Notification List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl mb-3">notifications_off</span>
          <p className="text-sm font-medium">{t('No notifications found')}</p>
          <p className="text-xs mt-1">{t('Try changing your filters')}</p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
          {filteredNotifications.map((notif, idx) => (
            <div
              key={notif.id}
              className={`flex items-start gap-4 px-5 py-4 hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-b-0 ${
                !notif.is_read ? 'bg-primary-fixed/5' : ''
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  notif.type === 'order_overdue'
                    ? 'bg-error/10'
                    : notif.type === 'payment_received'
                    ? 'bg-tertiary/10'
                    : 'bg-primary/10'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-xl ${
                    TYPE_COLORS[notif.type] || 'text-on-surface-variant'
                  }`}
                >
                  {TYPE_ICONS[notif.type] || 'info'}
                </span>
              </div>

              {/* Content */}
              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => handleNotificationClick(notif)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-on-surface truncate">
                    {notif.title}
                  </span>
                  {!notif.is_read && (
                    <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                  {notif.order_number && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shrink-0">
                      {notif.order_number}
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5">{notif.message}</p>
                <span className="text-[11px] text-secondary mt-1 block">
                  {notif.created_at ? formatDate(notif.created_at) : ''}
                </span>
              </div>

              {/* Actions */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleDelete(notif.id);
                }}
                className="p-1.5 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors shrink-0"
                title={t('Delete')}
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
