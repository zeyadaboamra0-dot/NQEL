"use client";

import { useState } from "react";
import { apiFetch, navigate, useApi, type OrderRow, type RepRow, type StatusHistoryRow } from "@/lib/client";
import { EmptyState, KVCard, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  formatDateTime,
  durationLabel,
  formatMoney,
  ORDER_STATUS_LABELS,
} from "@/lib/constants";
import {
  Banknote,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  RefreshCcw,
  Trash2,
  Truck,
  UserRoundCog,
} from "lucide-react";

type OrderDetailData = {
  order: OrderRow & {
    customer: { id: number; name: string; phone: string; altPhone?: string; governorate?: string; city?: string; address?: string };
    rep?: { id: number; name: string; phone?: string } | null;
    shipmentType?: { name: string } | null;
    statusHistory: StatusHistoryRow[];
    onWayPickupAt?: string | null;
    onWayDeliveryAt?: string | null;
  };
};

export function OrderDetail({ orderId }: { orderId: number }) {
  const { data, loading, error, refresh } = useApi<OrderDetailData>(`/api/orders/${orderId}`);
  const { data: meta } = useApi<{ reps: RepRow[]; settings: { currency: string } }>("/api/meta");
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [assignRep, setAssignRep] = useState("");
  const [assignCommission, setAssignCommission] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [showOtp, setShowOtp] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title="تعذر تحميل الطلب" hint={error} />;
  if (!data) return null;
  const o = data.order;
  const currency = meta?.settings?.currency ?? "ج.م";
  const durationMs =
    o.assignedAt && o.deliveredAt
      ? new Date(o.deliveredAt).getTime() - new Date(o.assignedAt).getTime()
      : null;

  async function doAssign() {
    if (!assignRep) return;
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${orderId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          repId: Number(assignRep),
          commission: assignCommission === "" ? undefined : Number(assignCommission),
        }),
      });
      toast.success("تم إسناد الطلب وإرسال إشعار للمندوب");
      setAssignOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!cancelReason.trim()) {
      toast.error("أدخل سبب الإلغاء");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify({ status: "CANCELLED", reason: cancelReason }),
      });
      toast.success("تم إلغاء الطلب");
      setCancelOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      await apiFetch(`/api/orders/${orderId}`, { method: "DELETE" });
      toast.success("تم حذف الطلب وتسجيل العملية");
      navigate("admin/orders");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleCollected() {
    try {
      await apiFetch(`/api/orders/${orderId}/collection`, {
        method: "POST",
        body: JSON.stringify({ collected: !o.collectionCollected }),
      });
      toast.success(o.collectionCollected ? "تم تعليم التحصيل كغير محصل" : "تم تأكيد التحصيل");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function regenOtp() {
    try {
      await apiFetch(`/api/orders/${orderId}/otp`, { method: "POST" });
      setShowOtp(true);
      toast.success("تم توليد رمز جديد");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const closed = ["DELIVERED", "CANCELLED"].includes(o.status);

  return (
    <div className="space-y-5">
      {/* الرأس */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate("admin/orders")} aria-label="رجوع">
            →
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-extrabold sm:text-2xl">{o.orderNumber}</h1>
              <StatusBadge status={o.status} />
              {o.attempts > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                  محاولات التسليم: {o.attempts}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              أُنشئ في {formatDateTime(o.createdAt)} بواسطة {o.createdByName ?? "الإدارة"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigate(`admin/orders/${orderId}/edit`)}>
            <Pencil className="h-4 w-4" />
            تعديل
          </Button>
          {!closed && (
            <Button size="sm" className="gap-1.5" onClick={() => { setAssignRep(String(o.repId ?? "")); setAssignCommission(String(o.repCommission ?? "")); setAssignOpen(true); }}>
              <UserRoundCog className="h-4 w-4" />
              {o.rep ? "إعادة إسناد" : "إسناد لمندوب"}
            </Button>
          )}
          {!closed && (
            <Button variant="outline" size="sm" className="gap-1.5 text-red-600" onClick={() => setCancelOpen(true)}>
              <Trash2 className="h-4 w-4" />
              إلغاء الطلب
            </Button>
          )}
          <Button variant="ghost" size="sm" className="gap-1.5 text-red-600" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" />
            حذف
          </Button>
        </div>
      </div>

      {/* البطاقات */}
      <div className="grid gap-4 lg:grid-cols-3">
        <KVCard
          title="العميل والوجهة"
          rows={[
            ["اسم العميل", o.customer?.name],
            [
              "رقم الهاتف",
              <a key="p" href={`tel:${o.phone}`} className="inline-flex items-center gap-1 text-teal-700 hover:underline" dir="ltr">
                <Phone className="h-3.5 w-3.5" /> {o.phone}
              </a>,
            ],
            o.altPhone ? ["هاتف بديل", <span key="a" dir="ltr">{o.altPhone}</span>] : null,
            ["المحافظة / المدينة", `${o.governorate} / ${o.city}`],
            ["العنوان التفصيلي", o.addressDetail],
            ["اسم المستلم", o.receiverSigned ?? o.receiverName ?? "—"],
            o.mapLink
              ? [
                  "الموقع على الخريطة",
                  <a key="m" href={o.mapLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-teal-700 hover:underline">
                    <MapPin className="h-3.5 w-3.5" /> فتح Google Maps
                  </a>,
                ]
              : null,
          ].filter(Boolean) as [string, React.ReactNode][]}
        />

        <KVCard
          title="الشحنة والتوصيل"
          rows={[
            ["نوع الشحنة", o.shipmentType?.name],
            ["وصف الشحنة", o.shipmentDesc ?? "—"],
            ["الحجم / الوزن", o.shipmentSize ?? "—"],
            ["مكان الاستلام", o.pickupPlace],
            ["مكان التسليم", o.deliveryPlace ?? "—"],
            ["الموعد المتوقع", o.expectedDeliveryAt ? formatDateTime(o.expectedDeliveryAt) : "غير محدد"],
            ["الملاحظات", o.notes ?? "—"],
          ]}
        />

        <div className="space-y-4">
          <KVCard
            title="البيانات المالية"
            rows={[
              ["قيمة التحصيل (COD)", formatMoney(o.collectionAmount, currency)],
              ["أجرة التوصيل (إيراد)", formatMoney(o.deliveryFee, currency)],
              ["تكلفة الشحنة", formatMoney(o.shipmentCost, currency)],
              ["مصروفات إضافية", formatMoney(o.additionalExpenses, currency)],
              ["مستحق المندوب", formatMoney(o.repCommission, currency)],
              ["الإيراد الفعلي لـ NQEL", <span key="r" className="font-bold text-teal-700">{formatMoney(o.nqelRevenue, currency)}</span>],
              ["صافي ربح الطلب", <span key="n" className={`font-extrabold ${o.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatMoney(o.netProfit, currency)}</span>],
            ]}
          />
          {o.collectionAmount > 0 && (
            <div className="flex items-center justify-between rounded-xl border bg-card p-4 shadow-sm">
              <div>
                <p className="text-sm font-bold">حالة التحصيل</p>
                <p className={`text-xs font-semibold ${o.collectionCollected ? "text-emerald-600" : "text-amber-600"}`}>
                  {o.collectionCollected ? "✓ تم تحصيل المبلغ من العميل" : "لم يتم التحصيل بعد"}
                </p>
              </div>
              <Button variant={o.collectionCollected ? "outline" : "default"} size="sm" onClick={toggleCollected} className="gap-1.5">
                <Banknote className="h-4 w-4" />
                {o.collectionCollected ? "إلغاء التحصيل" : "تأكيد التحصيل"}
              </Button>
            </div>
          )}
          {o.otpCode && (
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    <KeyRound className="h-4 w-4 text-teal-700" />
                    رمز تأكيد التسليم (OTP)
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    يُطلب من العميل عند التسليم — أعطه للمندوب أو للعميل
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => setShowOtp(!showOtp)} aria-label="إظهار الرمز">
                    {showOtp ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(o.otpCode!); toast.success("تم النسخ"); }} aria-label="نسخ">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={regenOtp} aria-label="توليد رمز جديد">
                    <RefreshCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {showOtp && (
                <p className="mt-3 rounded-lg bg-teal-50 py-2 text-center text-2xl font-black tracking-[0.5em] text-teal-800">
                  {o.otpCode}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* المندوب + زمن التنفيذ */}
      <div className="grid gap-4 lg:grid-cols-2">
        <KVCard
          title="المندوب وتتبع التنفيذ"
          rows={[
            ["المندوب المسؤول", o.rep?.name ?? "غير مُسند"],
            ["وقت الإسناد", formatDateTime(o.assignedAt)],
            ["وقت القبول", formatDateTime(o.acceptedAt)],
            ["الخروج للاستلام", formatDateTime(o.onWayPickupAt)],
            ["استلام الشحنة", formatDateTime(o.pickedUpAt)],
            ["الخروج للعميل", formatDateTime(o.onWayDeliveryAt)],
            ["التسليم النهائي", formatDateTime(o.deliveredAt)],
            ["مدة التنفيذ", durationMs !== null ? durationLabel(durationMs) : "—"],
            [
              "الالتزام بالموعد",
              o.deliveredAt
                ? o.expectedDeliveryAt && o.deliveredAt <= o.expectedDeliveryAt
                  ? <span key="ok" className="text-emerald-600">تم التسليم في الموعد ✓</span>
                  : <span key="late" className="text-red-600">تم التسليم متأخرًا</span>
                : "—",
            ],
            o.failureReason ? ["سبب المشكلة", o.failureReason] : null,
            o.postponeReason ? ["سبب التأجيل", o.postponeReason] : null,
            o.cancelReason ? ["سبب الإلغاء", o.cancelReason] : null,
            o.receiverSigned ? ["اسم المستلم المسجل", o.receiverSigned] : null,
            o.deliveryProof ? ["إثبات التسليم", o.deliveryProof] : null,
          ].filter(Boolean) as [string, React.ReactNode][]}
        />

        {/* خط زمني للحالات */}
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-bold">
            <Truck className="h-4 w-4 text-teal-700" />
            سجل حالات الطلب
          </h3>
          <div className="max-h-[420px] space-y-0 overflow-y-auto pr-1">
            {[...o.statusHistory].reverse().map((h, i, arr) => (
              <div key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < arr.length - 1 && <div className="absolute right-[7px] top-5 h-full w-px bg-border" />}
                <div
                  className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${
                    i === 0 ? "border-teal-600 bg-teal-600" : "border-muted-foreground/30 bg-background"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{ORDER_STATUS_LABELS[h.status as keyof typeof ORDER_STATUS_LABELS] ?? h.status}</p>
                  {h.note && <p className="mt-0.5 break-words text-xs text-muted-foreground">{h.note}</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {formatDateTime(h.createdAt)} — {h.actorName} ({h.actorType === "ADMIN" ? "إدارة" : h.actorType === "REP" ? "مندوب" : "نظام"})
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* حوار الإسناد */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{o.rep ? "إعادة إسناد الطلب" : "إسناد الطلب لمندوب"}</DialogTitle>
            <DialogDescription>
              سيصل المندوب إشعار داخل النظام فور الإسناد، وسيُسجل وقت القبول والاستلام تلقائيًا.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>اختر المندوب</Label>
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {meta?.reps?.filter((r) => r.id !== o.repId).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setAssignRep(String(r.id));
                    // تعبئة العمولة الافتراضية للمندوب إن كان الطلب بدون عمولة
                    if (o.repCommission === 0) setAssignCommission(String(r.defaultCommission ?? 0));
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border p-3 text-right transition-colors ${
                    assignRep === String(r.id) ? "border-teal-600 bg-teal-50" : "hover:bg-accent/50"
                  }`}
                >
                  <span className="font-semibold">{r.name}</span>
                  <span dir="ltr" className="text-xs text-muted-foreground">{r.code}</span>
                </button>
              ))}
              {meta?.reps?.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">لا يوجد مناديب مفعّلة — أضف مندوبًا أولًا</p>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>مستحق المندوب لهذا الطلب</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={assignCommission}
              onChange={(e) => setAssignCommission(e.target.value)}
              placeholder="0"
            />
            <p className="text-[11px] text-muted-foreground">
              يُحتسب ضمن مصروفات الطلب ويظهر في مستحقات المندوب عند التسليم
            </p>
          </div>
          <DialogFooter>
            <Button onClick={doAssign} disabled={!assignRep || busy} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" />
              تأكيد الإسناد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار الإلغاء */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>إلغاء الطلب {o.orderNumber}</DialogTitle>
            <DialogDescription>سيُسجل الإلغاء باسمك مع السبب، ويصل إشعار للمندوب المسؤول.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>سبب الإلغاء *</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={3} placeholder="مثال: العميل طلب التأجيل لأسبوع..." />
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={doCancel} disabled={busy || !cancelReason.trim()} className="gap-1.5">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الإلغاء
            </Button>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>تراجع</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الطلب نهائيًا؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيُحذف الطلب {o.orderNumber} وسجل حالاته نهائيًا، مع تسجيل عملية الحذف في سجل العمليات. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete} className="bg-red-600 hover:bg-red-700">
              نعم، حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
