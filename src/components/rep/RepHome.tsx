"use client";

import { navigate, useApi, type OrderRow } from "@/lib/client";
import { EmptyState, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/constants";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock,
  PackageCheck,
  Truck,
  Wallet,
} from "lucide-react";

type RepOrdersData = {
  orders: OrderRow[];
  cards: {
    assigned: number;
    accepted: number;
    onWayPickup: number;
    pickedUp: number;
    onWayDelivery: number;
    delivered: number;
    failed: number;
    postponed: number;
    late: number;
    total: number;
  };
};

export function RepHome() {
  const { data, loading, error } = useApi<RepOrdersData>("/api/rep/orders?pageSize=5&group=open");

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title={error} />;

  const c = data?.cards;
  const newOnes = data?.orders.filter((o) => o.status === "ASSIGNED") ?? [];

  return (
    <div className="space-y-5">
      {/* بطاقات العدّ */}
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat title="مُسندة لي" value={c?.assigned ?? 0} tone="violet" />
        <MiniStat title="قيد التنفيذ" value={c ? c.accepted + c.onWayPickup + c.pickedUp + c.onWayDelivery : 0} tone="teal" />
        <MiniStat title="متأخرة" value={c?.late ?? 0} tone="amber" />
        <MiniStat title="تم تسليمها" value={c?.delivered ?? 0} tone="emerald" />
        <MiniStat title="فاشلة" value={c?.failed ?? 0} tone="red" />
        <MiniStat title="مؤجلة" value={c?.postponed ?? 0} tone="slate" />
      </div>

      {/* طلبات جديدة تنتظر القبول */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-bold">
            <ClipboardList className="h-4 w-4 text-teal-700" />
            طلبات تنتظر قبولك
          </h2>
          <Button variant="ghost" size="sm" className="text-teal-700" onClick={() => navigate("rep/orders")}>
            كل الطلبات
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
        {newOnes.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              لا توجد طلبات جديدة — أنت متقدم! 👍
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {newOnes.map((o) => (
              <OrderCard key={o.id} order={o} highlight />
            ))}
          </div>
        )}
      </div>

      {/* آخر الطلبات النشطة */}
      <div>
        <h2 className="mb-2 flex items-center gap-2 font-bold">
          <Truck className="h-4 w-4 text-teal-700" />
          قيد التنفيذ الآن
        </h2>
        {(data?.orders.filter((o) => o.status !== "ASSIGNED") ?? []).length === 0 ? (
          <EmptyState title="لا توجد طلبات قيد التنفيذ" />
        ) : (
          <div className="space-y-2.5">
            {data?.orders
              .filter((o) => o.status !== "ASSIGNED")
              .map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        )}
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => navigate("rep/earnings")}
      >
        <Wallet className="h-4 w-4" />
        عرض مستحقاتي المالية
      </Button>
    </div>
  );
}

export function MiniStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "violet" | "teal" | "amber" | "emerald" | "red" | "slate";
}) {
  const tones: Record<string, string> = {
    violet: "bg-violet-50 border-violet-200 text-violet-800",
    teal: "bg-teal-50 border-teal-200 text-teal-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    red: "bg-red-50 border-red-200 text-red-800",
    slate: "bg-slate-100 border-slate-200 text-slate-700",
  };
  return (
    <div className={`rounded-xl border p-3 text-center shadow-sm ${tones[tone]}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold">{title}</p>
    </div>
  );
}

export function OrderCard({ order: o, highlight }: { order: OrderRow; highlight?: boolean }) {
  const isLate = o.expectedDeliveryAt && new Date(o.expectedDeliveryAt) < new Date() && !["DELIVERED", "CANCELLED", "FAILED", "NO_ANSWER", "REFUSED"].includes(o.status);
  return (
    <button
      onClick={() => navigate(`rep/orders/${o.id}`)}
      className={`w-full rounded-xl border bg-card p-4 text-right shadow-sm transition-all hover:shadow-md active:scale-[0.99] ${
        highlight ? "border-teal-500 ring-1 ring-teal-500/30" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-black text-teal-800">{o.orderNumber}</span>
        <StatusBadge status={o.status} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
        <p className="truncate font-semibold">{o.customer?.name ?? "عميل"}</p>
        <p className="truncate text-muted-foreground">{o.governorate} / {o.city}</p>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <PackageCheck className="h-3.5 w-3.5" />
          تحصيل: {o.collectionAmount > 0 ? `${o.collectionAmount} ج.م` : "لا يوجد"}
        </span>
        {o.expectedDeliveryAt && (
          <span className={`flex items-center gap-1 ${isLate ? "font-bold text-red-600" : ""}`}>
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(o.expectedDeliveryAt)}
          </span>
        )}
      </div>
      {isLate && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-bold text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          تجاوز الموعد المحدد
        </p>
      )}
    </button>
  );
}
