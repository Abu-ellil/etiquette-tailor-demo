import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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

function formatRelativeTime(dateStr: string, t: (k: string) => string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t('just now');
  if (diffMin < 60) return `${diffMin}m ${t('ago')}`;
  if (diffHour < 24) return `${diffHour}h ${t('ago')}`;
  if (diffDay < 7) return `${diffDay}d ${t('ago')}`;
  return date.toLocaleDateString();
}

export default function NotificationBell({ session }: { session: Session }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!session?.userId) return;
    try {
      const [notifs, count] = await Promise.all([
        window.electronAPI.notifications.getForUser(session.userId, session.role, 20),
        window.electronAPI.notifications.getUnreadCount(session.userId, session.role),
      ]);
      setNotifications(notifs || []);
      setUnreadCount(count || 0);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  }, [session?.userId, session?.role]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (isOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node) && buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      await window.electronAPI.notifications.markAllAsRead(session.userId, session.role);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const handleClearRead = async () => {
    try {
      await window.electronAPI.notifications.clearRead(session.userId, session.role);
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (e) {
      console.error('Failed to clear read notifications:', e);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    try {
      if (!notif.is_read) {
        await window.electronAPI.notifications.markAsRead(notif.id);
        setUnreadCount(prev => Math.max(0, prev - 1));
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      }
      setIsOpen(false);
      if (notif.order_id) {
        navigate(`/orders/${notif.order_id}`);
      }
    } catch (e) {
      console.error('Failed to handle notification click:', e);
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant relative"
        title={t('Notifications')}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-error text-on-error rounded-full text-[10px] font-bold flex items-center justify-center px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute end-0 top-12 w-80 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/20 z-50 flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20">
            <h3 className="text-sm font-bold text-on-surface">{t('Notifications')}</h3>
            <div className="flex items-center gap-3">
              {notifications.some(n => n.is_read) && (
                <button
                  onClick={handleClearRead}
                  className="text-xs text-error font-semibold hover:underline"
                >
                  {t('Clear read')}
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  {t('Mark all as read')}
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-96">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-secondary">
                <span className="material-symbols-outlined text-3xl mb-2 text-on-surface-variant">notifications_off</span>
                <p className="text-xs">{t('No notifications')}</p>
              </div>
            ) : (
              notifications.map(notif => (
                <button
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`w-full text-start px-4 py-3 flex items-start gap-3 hover:bg-surface-container-high transition-colors border-b border-outline-variant/10 last:border-b-0 ${
                    !notif.is_read ? 'bg-primary-fixed/10' : ''
                  }`}
                >
                  <span className={`material-symbols-outlined text-lg mt-0.5 shrink-0 ${TYPE_COLORS[notif.type] || 'text-on-surface-variant'}`}>
                    {TYPE_ICONS[notif.type] || 'info'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface truncate">{notif.title}</span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">{notif.message}</p>
                    {notif.created_at && (
                      <span className="text-[10px] text-secondary mt-1 block">
                        {formatRelativeTime(notif.created_at, t)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <Link
            to="/notifications"
            onClick={() => setIsOpen(false)}
            className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-surface-container-high transition-colors border-t border-outline-variant/20"
          >
            <span className="material-symbols-outlined text-sm">history</span>
            {t('View all notifications')}
          </Link>
        </div>
      )}
    </div>
  );
}
