"use client";

import { useEffect, useState } from "react";
import { useApi, type OrderRow } from "@/lib/client";
import { EmptyState, Pagination, Spinner } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { OrderCard } from "@/components/rep/RepHome";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "assigned", label: "انتظار القبول" },
  { key: "active", label: "قيد التنفيذ" },
  { key: "delivered", label: "مُسلّمة" },
  { key: "failed", label: "فاشلة" },
  { key: "all", label: "الكل" },
];

export function RepOrders({ group }: { group: string }) {
  const [tab, setTab] = useState(group);
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQ(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const { data, loading } = useApi<{
    orders: OrderRow[];
    total: number;
    page: number;
    pageCount: number;
  }>(`/api/rep/orders?group=${tab}&page=${page}&pageSize=10${appliedQ ? `&q=${encodeURIComponent(appliedQ)}` : ""}`);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold">{group === "history" ? "سجل الطلبات السابقة" : "طلباتي"}</h1>

      {group !== "history" && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key);
                setPage(1);
              }}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors",
                tab === t.key
                  ? "border-teal-600 bg-teal-600 text-white"
                  : "bg-card text-muted-foreground hover:bg-accent"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="بحث برقم الطلب أو العميل أو الهاتف..."
          className="pr-9"
        />
      </div>

      {loading && !data ? (
        <Spinner />
      ) : !data || data.orders.length === 0 ? (
        <EmptyState title="لا توجد طلبات هنا" hint="ستظهر الطلبات المسندة إليك من الإدارة في هذه القائمة" />
      ) : (
        <>
          <div className="space-y-2.5">
            {data.orders.map((o) => (
              <OrderCard key={o.id} order={o} highlight={o.status === "ASSIGNED"} />
            ))}
          </div>
          <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} />
        </>
      )}
    </div>
  );
}
