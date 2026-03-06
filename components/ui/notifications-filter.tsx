"use client";

import * as React from "react";
import {
  Bell,
  Info,
  AlertCircle,
  Calendar,
  Filter,
  Wallet,
  Zap,
  Receipt,
  Users,
  Loader2,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/apiBase";
import { supabase } from "@/lib/supabase";
import { getUserFromStorage } from "@/lib/session";

export type NotificationCategory = "updates" | "alerts" | "reminders";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  data: Record<string, unknown>;
  category: NotificationCategory;
}

const typeToCategory: Record<string, NotificationCategory> = {
  transaction: "updates",
  payment: "updates",
  referral: "updates",
  system: "alerts",
  utility: "reminders",
  invoice: "reminders",
};

const categoryIcons: Record<NotificationCategory, React.ReactNode> = {
  updates: <Info className="h-4 w-4 text-secondary" />,
  alerts: <AlertCircle className="h-4 w-4 text-warning" />,
  reminders: <Calendar className="h-4 w-4 text-secondary" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  payment: <Wallet className="h-4 w-4 text-secondary" />,
  transaction: <Wallet className="h-4 w-4 text-secondary" />,
  utility: <Zap className="h-4 w-4 text-secondary" />,
  invoice: <Receipt className="h-4 w-4 text-secondary" />,
  referral: <Users className="h-4 w-4 text-secondary" />,
  system: <AlertCircle className="h-4 w-4 text-warning" />,
};

const categories = [
  { key: "all", label: "All" },
  { key: "updates", label: "Updates" },
  { key: "alerts", label: "Alerts" },
  { key: "reminders", label: "Reminders" },
] as const;

interface NotificationsFilterProps {
  placement?: "top" | "bottom" | "left" | "right";
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsFilter({
  placement = "bottom",
}: NotificationsFilterProps) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [selected, setSelected] = React.useState<string>("all");
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    try {
      const user = await getUserFromStorage();
      if (!user?.id) return;

      const response = await fetch(getApiUrl("/api/notifications?limit=20"));
      const data = await response.json();

      if (data.success && Array.isArray(data.notifications)) {
        const items: NotificationItem[] = data.notifications.map(
          (n: { id: string; type: string; title: string; message: string; read: boolean; created_at: string; data?: Record<string, unknown> }) => ({
            ...n,
            category: typeToCategory[n.type] ?? "updates",
            data: n.data ?? {},
          }),
        );
        setNotifications(items);
        setUnreadCount(data.unreadCount ?? items.filter((i) => !i.read).length);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  React.useEffect(() => {
    const user = getUserFromStorage();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    if (!user?.id) {
      interval = setInterval(fetchNotifications, 30000);
      return () => {
        if (interval) clearInterval(interval);
      };
    }

    try {
      channel = supabase
        .channel(`notifications-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => fetchNotifications(),
        )
        .subscribe();
    } catch {
      // Fallback to polling
    }

    interval = setInterval(fetchNotifications, 30000);

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [fetchNotifications]);

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch(getApiUrl(`/api/notifications/${id}/read`), {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const res = await fetch(getApiUrl("/api/notifications/read-all"), {
        method: "POST",
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const filteredItems =
    selected === "all"
      ? notifications
      : notifications.filter((item) => item.category === selected);

  const getIcon = (item: NotificationItem) =>
    typeIcons[item.type] ?? categoryIcons[item.category];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex items-center justify-center rounded-full p-2 bg-primary/40 border border-accent/10 hover:bg-surface-highlight transition-colors"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-secondary" />
          {unreadCount > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 text-xs px-1.5 py-0 min-w-[1.25rem]"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side={placement}
        align="end"
        className="w-80 sm:w-96 p-0 max-h-[500px] flex flex-col bg-surface/95 backdrop-blur-[24px] border border-secondary/10 rounded-xl"
      >
        <div className="flex justify-between items-center border-b border-accent/10 px-4 py-3">
          <h2 className="text-base font-bold text-accent flex items-center gap-2">
            <Filter className="h-4 w-4 text-secondary" /> Notifications
          </h2>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="text-xs text-secondary hover:text-secondary/80"
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="flex gap-2 px-4 py-2 border-b border-accent/10 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <Button
              key={cat.key}
              variant={selected === cat.key ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setSelected(cat.key)}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3 text-accent/80">
            <Loader2 className="h-8 w-8 animate-spin text-secondary" />
            <p className="text-sm">Loading...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-8 text-center text-accent/70">
            <Bell className="h-12 w-12 mx-auto mb-2 opacity-50 text-accent/60" />
            <p className="text-sm">No notifications in this category</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto divide-y divide-accent/10 custom-scrollbar">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  if (!item.read) markAsRead(item.id);
                }}
                className={`p-4 hover:bg-surface-highlight/80 transition cursor-pointer ${
                  !item.read ? "bg-primary/40 border-l-2 border-l-secondary" : ""
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-primary/40 border border-accent/10 flex items-center justify-center shrink-0">
                      {getIcon(item)}
                    </div>
                    <span className="font-semibold text-sm text-accent">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-xs text-accent/60 shrink-0">
                    {formatTime(item.created_at)}
                  </span>
                </div>
                <p className="text-xs text-accent/80 leading-relaxed pl-10">
                  {item.message}
                </p>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
