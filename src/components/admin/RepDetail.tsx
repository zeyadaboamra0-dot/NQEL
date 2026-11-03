"use client";

import { useState } from "react";
import { apiFetch, navigate, useApi, type OrderRow, type PayoutRow } from "@/lib/client";
import { EmptyState, Spinner, StatusBadge, KVCard, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { durationLabel, formatDate, formatDateTime, formatMoney } from "@/lib/constants";
import { BadgeCheck, Ban, ChevronRight, Clock, Loader2, PackageCheck, Percent, Wallet, XCircle } from "lucide-react";

type RepDetailData = {
  rep: {
    id: number; code: string; name: string; phone?: string; governorate?: string; city?: string;
    vehicleType?: string; active: boolean; defaultCommission: number; notes?: string; createdAt: string;
  };
  performance: {
    assigned: number; delivered: number; failed: number; inProgress: number; late: number;
    successRate: number; onTimeRate: number; avgDeliveryMs: number; attempts: number;
  };
  dues: { totalCommission: number; totalPaid: number; remaining: number };
  payouts: PayoutRow[];
  orders: OrderRow[];
};

export function RepDetail({ repId }: { repId: number }) {
  const { data, loading, error, refresh } = useApi<RepDetailData>(`/api/reps/${repId}`);
  const [payOpen, setPayOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title="تعذر تحميل المندوب" hint={error} />;
  if (!data) return null;
  const r = data.rep;
  const p = data.performance;
  const d = data.dues;

  async function toggleActive() {
    setBusy(true);
    try {
      await apiFetch(`/api/reps/${repId}`, { method: "PATCH", body: JSON.stringify({ active: !r.active }) });
      toast.success(r.active ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setDeactivateOpen(false);
    }
  }

  async function resetPin() {
    const pin = prompt("أدخل رمز PIN الجديد (6 خانات على الأقل):");
    if (!pin) return;
    try {
      await apiFetch(`/api/reps/${repId}`, { method: "PATCH", body: JSON.stringify({ resetPin: pin }) });
      toast.success("تم تعيين رمز PIN جديد");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function registerPayout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await apiFetch("/api/payouts", {
        method: "POST",
        body: JSON.stringify({
          repId,
          amount: Number(fd.get("amount")),
          note: fd.get("note"),
          advance: fd.get("advance") === "on",
        }),
      });
      toast.success("تم تسجيل الدفعة");
      setPayOpen(false);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("admin/reps")} aria-label="رجوع">
            <ChevronRight className="h-4 w-4 rotate-180" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold sm:text-2xl">{r.name}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {r.active ? "مفعّل" : "موقوف"}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              كود الدخول: <code className="font-bold text-teal-800" dir="ltr">{r.code}</code>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPayOpen(true)}>
            <Wallet className="h-4 w-4" />
            تسجيل دفعة
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={resetPin}>
            <Clock className="h-4 w-4" />
            تعيين PIN جديد
          </Button>
          <Button
            variant={r.active ? "outline" : "default"}
            size="sm"
            className={`gap-1.5 ${r.active ? "text-red-600" : ""}`}
            disabled={busy}
            onClick={() => (r.active ? setDeactivateOpen(true) : toggleActive())}
          >
            <Ban className="h-4 w-4" />
            {r.active ? "إيقاف الحساب" : "تفعيل الحساب"}
          </Button>
        </div>
      </div>

      {/* مؤشرات الأداء */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <StatCard title="طلبات مسندة" value={p.assigned} tone="teal" />
        <StatCard title="تم تسليمها" value={p.delivered} tone="emerald" icon={<PackageCheck className="h-5 w-5" />} />
        <StatCard title="فاشلة" value={p.failed} tone="red" icon={<XCircle className="h-5 w-5" />} />
        <StatCard title="متأخرة" value={p.late} tone="amber" icon={<Clock className="h-5 w-5" />} />
        <StatCard title="نسبة النجاح" value={`${p.successRate}%`} tone={p.successRate >= 70 ? "emerald" : p.successRate >= 40 ? "amber" : "red"} icon={<Percent className="h-5 w-5" />} />
        <StatCard title="متوسط وقت التسليم" value={durationLabel(p.avgDeliveryMs)} hint={`الالتزام بالمواعيد: ${p.onTimeRate}%`} icon={<BadgeCheck className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <KVCard
          title="بيانات المندوب"
          rows={[
            ["رقم الهاتف", r.phone ?? "—"],
            ["المحافظة", r.governorate ?? "—"],
            ["المدينة", r.city ?? "—"],
            ["المركبة", r.vehicleType ?? "—"],
            ["المستحق الافتراضي/طلب", formatMoney(r.defaultCommission)],
            ["تاريخ التعيين", formatDate(r.createdAt)],
            ["ملاحظات", r.notes ?? "—"],
          ]}
        />
        <KVCard
          title="المستحقات المالية"
          rows={[
            ["إجمالي المستحق (طلبات مسلّمة)", <span key="a" className="font-bold text-teal-700">{formatMoney(d.totalCommission)}</span>],
            ["إجمالي المدفوع", formatMoney(d.totalPaid)],
            [
              "المتبقي له",
              <span key="c" className={`font-extrabold ${d.remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                {formatMoney(d.remaining)}
              </span>,
            ],
          ]}
        />
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-bold">سجل الدفعات ({data.payouts.length})</h3>
          {data.payouts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">لا توجد دفعات مسجلة</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
              {data.payouts.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <div>
                    <p className="font-bold">{formatMoney(pay.amount)}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(pay.payoutDate)} {pay.note ? `— ${pay.note}` : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* طلبات المندوب */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3 font-bold">طلبات المندوب ({data.orders.length})</div>
        {data.orders.length === 0 ? (
          <EmptyState title="لا توجد طلبات في هذه الفترة" />
        ) : (
          <div className="max-h-[500px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">الطلب</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الوجهة</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">مستحق المندوب</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.orders.map((o) => (
                  <TableRow key={o.id} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`admin/orders/${o.id}`)}>
                    <TableCell className="font-bold text-teal-800">{o.orderNumber}</TableCell>
                    <TableCell className="text-sm">{o.customer?.name}</TableCell>
                    <TableCell className="text-sm">{o.governorate} / {o.city}</TableCell>
                    <TableCell><StatusBadge status={o.status} /></TableCell>
                    <TableCell className="font-bold">{formatMoney(o.repCommission)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* حوار تسجيل دفعة */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة لـ {r.name}</DialogTitle>
            <DialogDescription>المتبقي له حاليًا: {formatMoney(d.remaining)}</DialogDescription>
          </DialogHeader>
          <form onSubmit={registerPayout} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة</Label>
              <Input name="note" placeholder="مثال: دفعة أسبوعية" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="advance" className="h-4 w-4 accent-teal-700" />
              سلفة (تتجاوز المستحق المتبقي)
            </label>
            <DialogFooter>
              <Button type="submit" disabled={busy} className="gap-1.5">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ الدفعة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إيقاف حساب المندوب؟</AlertDialogTitle>
            <AlertDialogDescription>
              لن يستطيع {r.name} تسجيل الدخول أو تحديث الطلبات بعد الإيقاف. يمكنك تفعيله لاحقًا في أي وقت.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={toggleActive} className="bg-red-600 hover:bg-red-700">
              إيقاف الحساب
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
