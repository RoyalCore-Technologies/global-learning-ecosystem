'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState, LoadingSpinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api-client';
import type { Notification } from '@platform/types';
import {
  Bell,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  UserPlus,
  CheckCheck,
  AlertTriangle,
  Info,
} from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'UNREAD' | 'ENDORSEMENTS' | 'COMMENTS'>('ALL');

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient<{ data: Notification[]; unreadCount: number }>('notifications?limit=50');
      if (res.data) {
        const notifs = (res.data as any).data || res.data;
        if (Array.isArray(notifs)) {
          setNotifications(notifs);
        }
        setUnreadCount((res.data as any).unreadCount || 0);
      }
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiClient(`notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignored
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient('notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignored
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'UNREAD') return !n.is_read;
    if (activeFilter === 'ENDORSEMENTS') return n.type === 'ACCURACY_ENDORSEMENT' || n.type === 'POST_UPVOTE';
    if (activeFilter === 'COMMENTS') return n.type === 'NEW_COMMENT';
    return true;
  });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'ACCURACY_ENDORSEMENT':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'POST_UPVOTE':
        return <Sparkles className="w-4 h-4 text-brand-indigo-400" />;
      case 'NEW_COMMENT':
        return <MessageSquare className="w-4 h-4 text-brand-violet-400" />;
      case 'NEW_FOLLOWER':
        return <UserPlus className="w-4 h-4 text-cyan-400" />;
      case 'SYSTEM_ALERT':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default:
        return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto space-y-6 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-surface-border/60">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Bell className="w-6 h-6 text-brand-indigo-400" /> Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-indigo-600 text-white">
                  {unreadCount} unread
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Peer endorsements, discussion responses, and academic updates.
            </p>
          </div>

          {unreadCount > 0 && (
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<CheckCheck className="w-4 h-4 text-brand-indigo-400" />}
              onClick={handleMarkAllRead}
            >
              Mark All as Read
            </Button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={activeFilter === 'ALL' ? 'primary' : 'outline'}
            onClick={() => setActiveFilter('ALL')}
          >
            All Notifications
          </Button>
          <Button
            size="sm"
            variant={activeFilter === 'UNREAD' ? 'primary' : 'outline'}
            onClick={() => setActiveFilter('UNREAD')}
          >
            Unread ({unreadCount})
          </Button>
          <Button
            size="sm"
            variant={activeFilter === 'ENDORSEMENTS' ? 'primary' : 'outline'}
            onClick={() => setActiveFilter('ENDORSEMENTS')}
          >
            Endorsements
          </Button>
          <Button
            size="sm"
            variant={activeFilter === 'COMMENTS' ? 'primary' : 'outline'}
            onClick={() => setActiveFilter('COMMENTS')}
          >
            Discussions
          </Button>
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <LoadingSpinner size="lg" />
              <p className="text-xs text-slate-400 font-mono">Fetching notifications...</p>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((notif) => (
              <Card
                key={notif.id}
                className={`p-4 flex items-start justify-between gap-4 transition-all ${
                  !notif.is_read
                    ? 'border-brand-indigo-500/40 bg-brand-indigo-950/20'
                    : 'border-surface-border/60 hover:border-surface-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-surface-elevated shrink-0 mt-0.5">
                    {getIconForType(notif.type)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-xs sm:text-sm">
                        {notif.title}
                      </span>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand-indigo-500 shrink-0" />
                      )}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {notif.body}
                    </p>

                    <span className="text-[10px] text-slate-500 font-mono block pt-0.5">
                      {new Date(notif.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {notif.resource_path && (
                    <Link href={notif.resource_path}>
                      <Button size="sm" variant="ghost" className="text-xs">
                        View &rarr;
                      </Button>
                    </Link>
                  )}

                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
                      title="Mark as read"
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <EmptyState
              title="No notifications"
              description="You're all caught up! Peer endorsements, responses, and follows will appear here."
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
