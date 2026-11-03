"use client";

import { useState } from "react";
import { navigate } from "@/lib/client";
import { EmptyState, PageHeader, Pagination, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useApi, type NotificationRow } from "@/lib/client";
import { formatDateTime } from "@/lib/constants";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Info,
  Package,
  RefreshCw,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";

function notifIcon(type: string) {
  switch (type) {
    case "ASSIGN":
    case "REASSIGN":
      return <Truck className="h-5 w-5 text-violet-600" />;
    case "ACCEPT":
      return <Package className="h-5 w-5 text-teal-600" />;
    case "DELIVERED":
      return <CheckCircle2 className="h-5 w-5 text-emerald-600" />;
    case "PROBLEM":
    case "FAILED":
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    default:
      return <Info className="h-5 w-5 text-slate-500" />;
  }
}

export function NotificationsView({ onChanged }: { onChanged?: () => void }) {
  const [page, setPage] = useState(1);
  const { data, loading, refresh } = useApi<{
    notifications: NotificationRow[];
    total: number;
    unread: number;
    page: number;
    pageCount: number;
  }>(`/api/notifications?pageSize=30&page=${page}`);

  async function markAll() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    refresh();
    onChanged?.();
  }

  async function markOne(id: number) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    refresh();
    onChanged?.();
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الإشعارات"
        subtitle={`${data?.unread ?? 0} إشعار غير مقروء`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh} aria-label="تحديث">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={markAll}>
              <CheckCheck className="h-4 w-4" />
              تعليم الكل كمقروء
            </Button>
          </>
        }
      />

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading && !data ? (
          <Spinner />
        ) : !data || data.notifications.length === 0 ? (
          <EmptyState title="لا توجد إشعارات" hint="ستظهر هنا إشعارات الإسناد والتسليم والمشاكل" />
        ) : (
          <ul className="divide-y">
            {data.notifications.map((n) => (
              <li
                key={n.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-4 py-3.5 transition-colors hover:bg-accent/40",
                  !n.read && "bg-teal-50/50"
                )}
                onClick={() => {
                  if (!n.read) markOne(n.id);
                  if (n.orderId) navigate(`admin/orders/${n.orderId}`);
                }}
              >
                <div className="mt-0.5 shrink-0">{notifIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-bold", !n.read && "text-teal-900")}>{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.orderId && (
                  <Button variant="ghost" size="sm" className="shrink-0 text-teal-700">
                    عرض الطلب
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.pageCount > 1 && (
        <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} />
      )}
      <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
        <Bell className="h-3.5 w-3.5" />
        اضغط على أي إشعار لفتح الطلب المرتبط به
      </p>
    </div>
  );
}
