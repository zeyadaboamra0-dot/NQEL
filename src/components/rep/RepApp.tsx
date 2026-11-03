"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, navigate, type Session } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ClipboardList,
  History,
  Home,
  LogOut,
  Wallet,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { RepHome } from "@/components/rep/RepHome";
import { RepOrders } from "@/components/rep/RepOrders";
import { RepOrderDetail } from "@/components/rep/RepOrderDetail";
import { RepEarnings } from "@/components/rep/RepEarnings";
import { RepProfile } from "@/components/rep/RepProfile";

const NAV = [
  { key: "home", label: "الرئيسية", icon: Home, path: "rep/home" },
  { key: "orders", label: "طلباتي", icon: ClipboardList, path: "rep/orders" },
  { key: "history", label: "السجل", icon: History, path: "rep/history" },
  { key: "earnings", label: "مستحقاتي", icon: Wallet, path: "rep/earnings" },
  { key: "profile", label: "حسابي", icon: UserRound, path: "rep/profile" },
];

export function RepApp({
  session,
  route,
  logout,
}: {
  session: Session;
  route: string[];
  logout: () => void;
}) {
  const [unread, setUnread] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);

  const loadUnread = useCallback(() => {
    apiFetch<{ unread: number }>("/api/notifications?unread=1")
      .then((d) => setUnread(d.unread))
      .catch(() => {});
  }, []);

  const view = route[1] ?? "home";
  const routeKey = route.join("/");

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 25000);
    return () => clearInterval(t);
  }, [loadUnread, routeKey]);

  const content = (() => {
    switch (view) {
      case "home":
        return <RepHome />;
      case "orders":
        if (route[2]) return <RepOrderDetail orderId={Number(route[2])} />;
        return <RepOrders group="active" />;
      case "history":
        return <RepOrders group="history" />;
      case "earnings":
        return <RepEarnings />;
      case "profile":
        return <RepProfile session={session} logout={logout} />;
      default:
        navigate("rep/home");
        return null;
    }
  })();

  const activeNav = view === "history" ? "history" : view === "orders" ? "orders" : view;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background" dir="rtl">
      {/* الرأس */}
      <header className="sticky top-0 z-30 bg-teal-800 px-4 pb-4 pt-4 text-white shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-sm font-black">
              {session.name.slice(0, 2)}
            </div>
            <div>
              <p className="text-sm font-bold">{session.name}</p>
              <p className="text-[11px] text-teal-200/80">مندوب توصيل — NQEL</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="relative text-white hover:bg-white/10"
              onClick={() => setShowNotifications(!showNotifications)}
              aria-label="الإشعارات"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -left-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-900">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
              onClick={logout}
              aria-label="تسجيل الخروج"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* لوحة الإشعارات */}
      {showNotifications && (
        <div className="sticky top-[76px] z-20 max-h-80 overflow-y-auto border-b bg-white shadow-lg">
          <p className="border-b bg-muted/50 px-4 py-2 text-sm font-bold">إشعاراتك</p>
          <RepNotifications
            onOpen={(orderId) => {
              setShowNotifications(false);
              if (orderId) navigate(`rep/orders/${orderId}`);
            }}
            onRead={() => loadUnread()}
          />
        </div>
      )}

      {/* المحتوى */}
      <main className="flex-1 p-4 pb-24">{content}</main>

      {/* شريط التنقل السفلي */}
      <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-lg border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="grid grid-cols-5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-colors",
                  active ? "text-teal-700" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                {item.label}
                <span className={cn("h-0.5 w-6 rounded-full", active ? "bg-teal-600" : "bg-transparent")} />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function RepNotifications({
  onOpen,
  onRead,
}: {
  onOpen: (orderId: number | null) => void;
  onRead: () => void;
}) {
  const { data, refresh } = useApi<{
    notifications: { id: number; title: string; body: string; orderId: number | null; read: boolean; createdAt: string; type: string }[];
  }>("/api/notifications?pageSize=20");

  async function open(id: number, orderId: number | null) {
    if (!id) return;
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
    onRead();
    onOpen(orderId);
  }

  if (!data || data.notifications.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد إشعارات</p>;
  }
  return (
    <ul className="divide-y">
      {data.notifications.map((n) => (
        <li
          key={n.id}
          className={cn("cursor-pointer px-4 py-3 hover:bg-accent/40", !n.read && "bg-teal-50/60")}
          onClick={() => open(n.id, n.orderId)}
        >
          <p className={cn("text-sm font-bold", !n.read && "text-teal-900")}>{n.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
        </li>
      ))}
    </ul>
  );
}

export { toast };
