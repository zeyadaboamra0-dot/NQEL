"use client";

import { useApi, type PayoutRow } from "@/lib/client";
import { EmptyState, Spinner, StatCard } from "@/components/shared";
import { formatDate, formatMoney, ORDER_STATUS_LABELS } from "@/lib/constants";
import { PackageCheck, Wallet, PiggyBank } from "lucide-react";

type EarningsData = {
  totalEarned: number;
  totalPaid: number;
  remaining: number;
  orders: { id: number; orderNumber: string; repCommission: number; deliveredAt: string | null }[];
  payouts: PayoutRow[];
};

export function RepEarnings() {
  const { data, loading, error } = useApi<EarningsData>("/api/rep/earnings");

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title={error} />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold">مستحقاتي المالية</h1>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="إجمالي ما كسبته" value={formatMoney(data.totalEarned)} tone="teal" icon={<PackageCheck className="h-5 w-5" />} hint="من الطلبات المُسلّمة" />
        <StatCard title="المدفوع لك" value={formatMoney(data.totalPaid)} tone="emerald" icon={<Wallet className="h-5 w-5" />} />
        <StatCard title="المتبقي لك" value={formatMoney(data.remaining)} tone="amber" icon={<PiggyBank className="h-5 w-5" />} />
      </div>

      {/* آخر الطلبات المحتسبة */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3 font-bold">طلباتك المُسلّمة المحتسبة</div>
        {data.orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات مُسلّمة بعد" />
        ) : (
          <div className="max-h-80 divide-y overflow-y-auto">
            {data.orders.map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-bold text-teal-800">{o.orderNumber}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(o.deliveredAt)}</p>
                </div>
                <span className="font-bold text-emerald-700">+{formatMoney(o.repCommission)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* سجل الدفعات */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3 font-bold">الدفعات التي استلمتها</div>
        {data.payouts.length === 0 ? (
          <EmptyState title="لا توجد دفعات بعد" hint="تظهر هنا الدفعات التي تسجلها الإدارة لك" />
        ) : (
          <div className="divide-y">
            {data.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-bold">{formatMoney(p.amount)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(p.payoutDate)} {p.note ? `— ${p.note}` : ""}
                  </p>
                </div>
                <Wallet className="h-4 w-4 text-emerald-600" />
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        المستحق يُحتسب فقط عند تحديث الطلب إلى حالة «{ORDER_STATUS_LABELS.DELIVERED}»
      </p>
    </div>
  );
}
