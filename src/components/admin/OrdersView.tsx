"use client";

import { useCallback, useEffect, useState } from "react";
import { navigate, useApi, type OrderRow } from "@/lib/client";
import { EmptyState, PageHeader, Pagination, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/constants";
import { ChevronLeft, MapPin, Plus, Search, X } from "lucide-react";

const GROUPS = [
  { value: "all", label: "كل الحالات" },
  { value: "new", label: "جديدة" },
  { value: "open", label: "مفتوحة (غير مُسلّمة)" },
  { value: "in_progress", label: "قيد التنفيذ" },
  { value: "delivered", label: "مُسلّمة" },
  { value: "late", label: "متأخرة" },
  { value: "failed", label: "فاشلة" },
  { value: "postponed", label: "مؤجلة" },
  { value: "cancelled", label: "ملغاة" },
];

export function OrdersView() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [group, setGroup] = useState("all");
  const [repId, setRepId] = useState("0");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("pageSize", "15");
  if (appliedQ) params.set("q", appliedQ);
  if (group !== "all") params.set("group", group);
  if (repId !== "0") params.set("repId", repId);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const { data, loading } = useApi<{
    orders: OrderRow[];
    total: number;
    page: number;
    pageCount: number;
  }>(`/api/orders?${params.toString()}`);
  const { data: meta } = useApi<{ reps: { id: number; name: string }[] }>("/api/meta");

  // debounce للبحث: يحدّث appliedQ بعد توقف الكتابة 400ms
  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQ(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  const resetFilters = useCallback(() => {
    setQ("");
    setAppliedQ("");
    setGroup("all");
    setRepId("0");
    setFrom("");
    setTo("");
    setPage(1);
  }, []);

  const hasFilters = appliedQ || group !== "all" || repId !== "0" || from || to;

  return (
    <div className="space-y-4">
      <PageHeader
        title="إدارة الطلبات"
        subtitle={`إجمالي ${data?.total ?? 0} طلب`}
        actions={
          <Button className="gap-2" onClick={() => navigate("admin/orders/new")}>
            <Plus className="h-4 w-4" />
            طلب جديد
          </Button>
        }
      />

      {/* الفلاتر */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث برقم الطلب، الهاتف، اسم العميل..."
            className="pr-9"
          />
        </div>
        <Select value={group} onValueChange={(v) => { setGroup(v); setPage(1); }}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={repId} onValueChange={(v) => { setRepId(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="المندوب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">كل المناديب</SelectItem>
            {meta?.reps?.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-[150px]" aria-label="من تاريخ" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-[150px]" aria-label="إلى تاريخ" />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="gap-1 text-red-600">
            <X className="h-4 w-4" />
            مسح الفلاتر
          </Button>
        )}
      </div>

      {/* الجدول */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading && !data ? (
          <Spinner />
        ) : !data || data.orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات مطابقة" hint="جرّب تعديل الفلاتر أو أضف طلبًا جديدًا" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">رقم الطلب</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الوجهة</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">التحصيل</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-left"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer transition-colors hover:bg-accent/40"
                    onClick={() => navigate(`admin/orders/${o.id}`)}
                  >
                    <TableCell className="font-bold text-teal-800">{o.orderNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{o.customer?.name}</div>
                      <div dir="ltr" className="text-right text-xs text-muted-foreground">{o.phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{o.governorate} / {o.city}</div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {o.pickupPlace} ← {o.deliveryPlace}
                      </div>
                    </TableCell>
                    <TableCell>
                      {o.rep ? (
                        <span className="text-sm font-medium">{o.rep.name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">غير مُسند</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold">{formatMoney(o.collectionAmount)}</span>
                      {o.collectionAmount > 0 && (
                        <div className={`text-[11px] ${o.collectionCollected ? "text-emerald-600" : "text-amber-600"}`}>
                          {o.collectionCollected ? "محصل ✓" : "غير محصل"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                      {o.attempts > 0 && (
                        <div className="mt-1 text-[11px] text-muted-foreground">محاولات: {o.attempts}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-left">
                      <Button variant="ghost" size="sm" className="gap-1 text-teal-700">
                        التفاصيل
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {data && (
        <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} />
      )}
    </div>
  );
}
