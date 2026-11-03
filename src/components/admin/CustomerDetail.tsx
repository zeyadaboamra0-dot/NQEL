"use client";

import { useState } from "react";
import { apiFetch, navigate, useApi, type CustomerRow, type OrderRow } from "@/lib/client";
import { EmptyState, KVCard, Spinner, StatCard, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate, formatDateTime, formatMoney } from "@/lib/constants";
import { ChevronRight, Loader2, MapPin, Pencil, Phone } from "lucide-react";

type CustomerDetailData = {
  customer: CustomerRow;
  stats: {
    totalOrders: number;
    deliveredCount: number;
    cancelledCount: number;
    failedCount: number;
    collectedTotal: number;
    uncollectedTotal: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
    isRepeat: boolean;
  };
  orders: OrderRow[];
};

export function CustomerDetail({ customerId }: { customerId: number }) {
  const { data, loading, error, refresh } = useApi<CustomerDetailData>(`/api/customers/${customerId}`);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title="تعذر تحميل العميل" hint={error} />;
  if (!data) return null;
  const c = data.customer;
  const s = data.stats;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiFetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: fd.get("name"),
          phone: fd.get("phone"),
          altPhone: fd.get("altPhone"),
          governorate: fd.get("governorate"),
          city: fd.get("city"),
          address: fd.get("address"),
          notes: fd.get("notes"),
        }),
      });
      toast.success("تم حفظ بيانات العميل");
      setEditOpen(false);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("admin/customers")} aria-label="رجوع">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold sm:text-2xl">{c.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.isRepeat ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>
                {s.isRepeat ? "عميل متكرر" : "عميل جديد"}
              </span>
            </div>
            <a href={`tel:${c.phone}`} className="mt-0.5 inline-flex items-center gap-1 text-sm text-teal-700 hover:underline" dir="ltr">
              <Phone className="h-3.5 w-3.5" /> {c.phone}
            </a>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditOpen(true)}>
          <Pencil className="h-4 w-4" />
          تعديل البيانات
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard title="إجمالي الطلبات" value={s.totalOrders} tone="teal" />
        <StatCard title="طلبات ناجحة" value={s.deliveredCount} tone="emerald" />
        <StatCard title="طلبات ملغاة" value={s.cancelledCount} tone="red" />
        <StatCard title="مدفوع (محصل)" value={formatMoney(s.collectedTotal)} />
        <StatCard title="غير محصل" value={formatMoney(s.uncollectedTotal)} tone={s.uncollectedTotal > 0 ? "amber" : "default"} />
        <StatCard title="أول طلب" value={formatDate(s.firstOrderAt)} hint={`آخر طلب: ${formatDate(s.lastOrderAt)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <KVCard
          title="بيانات العميل"
          rows={[
            ["الاسم", c.name],
            ["الهاتف", <span key="p" dir="ltr">{c.phone}</span>],
            ["هاتف بديل", c.altPhone ? <span key="a" dir="ltr">{c.altPhone}</span> : "—"],
            ["المحافظة", c.governorate ?? "—"],
            ["المدينة", c.city ?? "—"],
            ["العنوان", c.address ?? "—"],
            ["ملاحظات", c.notes ?? "—"],
            ["تاريخ التسجيل", formatDate(c.createdAt)],
          ]}
        />

        <div className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <MapPin className="h-4 w-4 text-teal-700" />
            سجل التعاملات الكامل ({data.orders.length} طلب)
          </h3>
          {data.orders.length === 0 ? (
            <EmptyState title="لا توجد طلبات بعد" />
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">الطلب</TableHead>
                    <TableHead className="text-right">الوجهة</TableHead>
                    <TableHead className="text-right">المندوب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التحصيل</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.orders.map((o) => (
                    <TableRow key={o.id} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`admin/orders/${o.id}`)}>
                      <TableCell className="font-bold text-teal-800">{o.orderNumber}</TableCell>
                      <TableCell className="text-sm">{o.governorate} / {o.city}</TableCell>
                      <TableCell className="text-sm">{o.rep?.name ?? "—"}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="text-sm font-semibold">
                        {formatMoney(o.collectionAmount)}
                        {o.collectionAmount > 0 && (
                          <span className={`block text-[11px] ${o.collectionCollected ? "text-emerald-600" : "text-amber-600"}`}>
                            {o.collectionCollected ? "محصل" : "غير محصل"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل بيانات العميل</DialogTitle>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الاسم *</Label>
              <Input name="name" defaultValue={c.name} required />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الهاتف *</Label>
              <Input name="phone" dir="ltr" className="text-left" defaultValue={c.phone} required />
            </div>
            <div className="space-y-1.5">
              <Label>هاتف بديل</Label>
              <Input name="altPhone" dir="ltr" className="text-left" defaultValue={c.altPhone ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>المحافظة</Label>
              <Input name="governorate" defaultValue={c.governorate ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>المدينة</Label>
              <Input name="city" defaultValue={c.city ?? ""} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>العنوان</Label>
              <Input name="address" defaultValue={c.address ?? ""} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Input name="notes" defaultValue={c.notes ?? ""} />
            </div>
            <DialogFooter className="col-span-full">
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
