"use client";

import { useState } from "react";
import { apiFetch, navigate, useApi, type OrderRow, type StatusHistoryRow } from "@/lib/client";
import { EmptyState, KVCard, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  durationLabel,
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABELS,
  REP_FLOW,
} from "@/lib/constants";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Banknote,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Phone,
  PhoneOff,
} from "lucide-react";

type RepOrderData = {
  order: Omit<OrderRow, "otpCode"> & {
    customer: { name: string; phone: string; altPhone?: string | null };
    rep?: { name: string } | null;
    shipmentType?: { name: string } | null;
    statusHistory: StatusHistoryRow[];
    onWayPickupAt?: string | null;
    onWayDeliveryAt?: string | null;
    hasOtp: boolean;
  };
};

type PendingAction = {
  status: string;
  label: string;
  needsReason: boolean;
  isDelivery: boolean;
};

export function RepOrderDetail({ orderId }: { orderId: number }) {
  const { data, loading, error, refresh } = useApi<RepOrderData>(`/api/rep/orders/${orderId}`);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title="تعذر فتح الطلب" hint={error} />;
  if (!data) return null;
  const o = data.order;

  const flow = REP_FLOW[o.status as keyof typeof REP_FLOW];
  const nextStatuses: string[] = flow?.next ?? [];
  const closed = ["DELIVERED", "CANCELLED"].includes(o.status);

  const durationMs =
    o.assignedAt && o.deliveredAt
      ? new Date(o.deliveredAt).getTime() - new Date(o.assignedAt).getTime()
      : null;

  const mapsUrl =
    o.mapLink ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${o.governorate} ${o.city} ${o.addressDetail}`
    )}`;

  async function submitAction(form?: FormData) {
    if (!pending) return;
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { status: pending.status };
      if (form) {
        if (pending.isDelivery) {
          payload.otpCode = String(form.get("otpCode") ?? "");
          payload.receiverSigned = String(form.get("receiverSigned") ?? "");
          payload.deliveryProof = String(form.get("deliveryProof") ?? "");
          payload.collected = form.get("collected") === "on";
        }
        if (pending.needsReason) payload.reason = String(form.get("reason") ?? "");
      }
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success(`تم تحديث حالة الطلب إلى: ${ORDER_STATUS_LABELS[pending.status as keyof typeof ORDER_STATUS_LABELS]}`);
      setPending(null);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function actionButton(status: string) {
    const cfg: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      ACCEPTED: {
        label: "قبول الطلب",
        className: "bg-violet-600 hover:bg-violet-700",
        icon: <CheckCircle2 className="h-5 w-5" />,
      },
      ON_WAY_PICKUP: {
        label: "الانطلاق لمكان الاستلام",
        className: "bg-teal-600 hover:bg-teal-700",
        icon: <Navigation className="h-5 w-5" />,
      },
      PICKED_UP: {
        label: "استلمت الشحنة",
        className: "bg-teal-600 hover:bg-teal-700",
        icon: <Package className="h-5 w-5" />,
      },
      ON_WAY_DELIVERY: {
        label: "الانطلاق إلى العميل",
        className: "bg-teal-600 hover:bg-teal-700",
        icon: <Navigation className="h-5 w-5" />,
      },
      DELIVERED: {
        label: "تم التسليم بنجاح",
        className: "bg-emerald-600 hover:bg-emerald-700",
        icon: <CheckCircle2 className="h-5 w-5" />,
      },
      FAILED: {
        label: "تعذر التسليم",
        className: "bg-red-600 hover:bg-red-700",
        icon: <Ban className="h-5 w-5" />,
      },
      NO_ANSWER: {
        label: "العميل لم يرد",
        className: "bg-amber-600 hover:bg-amber-700",
        icon: <PhoneOff className="h-5 w-5" />,
      },
      REFUSED: {
        label: "رفض الاستلام",
        className: "bg-rose-600 hover:bg-rose-700",
        icon: <Ban className="h-5 w-5" />,
      },
      POSTPONED: {
        label: "تأجيل التسليم",
        className: "bg-slate-600 hover:bg-slate-700",
        icon: <Clock className="h-5 w-5" />,
      },
    };
    const c = cfg[status];
    if (!c) return null;
    const isDelivery = status === "DELIVERED";
    const needsReason = ["FAILED", "POSTPONED", "NO_ANSWER", "REFUSED"].includes(status);
    return (
      <Button
        key={status}
        className={`h-14 flex-1 gap-2 text-base font-bold ${c.className} ${
          !["DELIVERED", "ACCEPTED"].includes(status) && status !== "ON_WAY_PICKUP" && status !== "PICKED_UP" && status !== "ON_WAY_DELIVERY" ? "" : ""
        }`}
        onClick={() => setPending({ status, label: c.label, needsReason, isDelivery })}
      >
        {c.icon}
        {c.label}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("rep/orders")}
        className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground"
      >
        <ArrowRight className="h-4 w-4" />
        رجوع لطلباتي
      </button>

      {/* الرأس */}
      <div className="rounded-2xl bg-gradient-to-l from-teal-800 to-teal-700 p-4 text-white shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xl font-black">{o.orderNumber}</span>
          <StatusBadge status={o.status} className="border-0 bg-white/15 text-white" />
        </div>
        <p className="mt-1 text-sm text-teal-100/90">{o.customer?.name}</p>
        {o.expectedDeliveryAt && (
          <p className="mt-1 flex items-center gap-1 text-xs text-teal-100/80">
            <Clock className="h-3.5 w-3.5" />
            الموعد المطلوب: {formatDateTime(o.expectedDeliveryAt)}
          </p>
        )}
        {o.attempts > 0 && (
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            محاولات سابقة: {o.attempts}
            {o.postponeReason ? ` — سبب التأجيل: ${o.postponeReason}` : ""}
          </p>
        )}
      </div>

      {/* أزرار الاتصال والخريطة */}
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={`tel:${o.phone}`}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-teal-600 bg-teal-50 font-bold text-teal-800 active:scale-[0.98]"
        >
          <Phone className="h-5 w-5" />
          اتصال بالعميل
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 font-bold text-amber-800 active:scale-[0.98]"
        >
          <MapPin className="h-5 w-5" />
          فتح الموقع
        </a>
      </div>

      {/* البيانات */}
      <KVCard
        title="عنوان التسليم"
        rows={[
          ["العنوان", o.addressDetail],
          ["المحافظة / المدينة", `${o.governorate} / ${o.city}`],
          ["مكان الاستلام", o.pickupPlace],
          ["مكان التسليم", o.deliveryPlace ?? "—"],
          ...(o.altPhone
            ? [["هاتف بديل", <a key="a" href={`tel:${o.altPhone}`} dir="ltr" className="text-teal-700">{o.altPhone}</a>] as [string, React.ReactNode]]
            : []),
        ]}
      />

      <KVCard
        title="الشحنة"
        rows={[
          ["نوع الشحنة", o.shipmentType?.name],
          ["الوصف", o.shipmentDesc ?? "—"],
          ["الحجم / الوزن", o.shipmentSize ?? "—"],
          [
            "قيمة التحصيل من العميل",
            o.collectionAmount > 0 ? (
              <span key="c" className="font-extrabold text-amber-700">
                {formatMoney(o.collectionAmount)} — يُحصل عند التسليم
              </span>
            ) : (
              "لا يوجد تحصيل"
            ),
          ],
          ["ملاحظات الإدارة", o.notes ?? "—"],
        ]}
      />

      {/* أزرار تحديث الحالة */}
      {!closed && nextStatuses.length > 0 && (
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-center text-sm font-bold text-muted-foreground">
            حدّث حالة الطلب حسب ما يجري فعليًا
          </h3>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => actionButton(s))}
          </div>
        </div>
      )}

      {o.status === "CANCELLED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
          <Ban className="mx-auto h-7 w-7 text-red-500" />
          <p className="mt-1 font-bold text-red-700">أُلغي هذا الطلب بطلب من الإدارة</p>
          {o.cancelReason && <p className="text-sm text-red-600">السبب: {o.cancelReason}</p>}
        </div>
      )}

      {/* ملخص التسليم */}
      {o.status === "DELIVERED" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-1 text-lg font-black text-emerald-700">تم التسليم بنجاح ✓</p>
          <div className="mt-2 space-y-1 text-sm text-emerald-800">
            {o.receiverSigned && <p>المستلم: <b>{o.receiverSigned}</b></p>}
            {o.collectionAmount > 0 && (
              <p>التحصيل: <b>{o.collectionCollected ? `${formatMoney(o.collectionAmount)} محصل ✓` : "غير محصل"}</b></p>
            )}
            {durationMs !== null && <p>مدة التنفيذ: {durationLabel(durationMs)}</p>}
          </div>
        </div>
      )}

      {/* الخط الزمني */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-bold">سجل الحالات</h3>
        <div className="space-y-0">
          {[...o.statusHistory].reverse().map((h, i, arr) => (
            <div key={h.id} className="relative flex gap-3 pb-3 last:pb-0">
              {i < arr.length - 1 && <div className="absolute right-[7px] top-4 h-full w-px bg-border" />}
              <div className={`relative z-10 mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${i === 0 ? "border-teal-600 bg-teal-600" : "border-muted-foreground/30 bg-background"}`} />
              <div className="min-w-0">
                <p className="text-sm font-bold">{ORDER_STATUS_LABELS[h.status as keyof typeof ORDER_STATUS_LABELS] ?? h.status}</p>
                {h.note && <p className="text-xs text-muted-foreground">{h.note}</p>}
                <p className="text-[11px] text-muted-foreground/80">{formatDateTime(h.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* حوار التسليم الناجح */}
      <Dialog open={pending?.isDelivery ?? false} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد التسليم — {o.orderNumber}</DialogTitle>
            <DialogDescription>
              أدخل بيانات التأكيد المطلوبة من الإدارة لإتمام التسليم.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAction(new FormData(e.currentTarget));
            }}
            className="space-y-3 py-1"
          >
            {o.hasOtp && (
              <div className="space-y-1.5">
                <Label>رمز تأكيد التسليم (OTP) *</Label>
                <Input
                  name="otpCode"
                  dir="ltr"
                  inputMode="numeric"
                  className="text-center text-xl font-black tracking-[0.4em]"
                  placeholder="••••••"
                  maxLength={6}
                  required
                />
                <p className="text-[11px] text-muted-foreground">اطلب الرمز من العميل — يظهر في تطبيقه من الإدارة</p>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>اسم المستلم *</Label>
              <Input name="receiverSigned" required placeholder="الاسم الفعلي لمن استلم الشحنة" />
            </div>
            <div className="space-y-1.5">
              <Label>إثبات تسليم (اختياري)</Label>
              <Textarea name="deliveryProof" rows={2} placeholder="مثال: تم التسليم لموظف الاستقبال — ورد رقم 12" />
            </div>
            {o.collectionAmount > 0 && (
              <label className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <span className="text-sm font-bold text-amber-900">
                  حصلت على مبلغ {formatMoney(o.collectionAmount)} من العميل
                </span>
                <input type="checkbox" name="collected" defaultChecked className="h-5 w-5 accent-teal-700" />
              </label>
            )}
            <DialogFooter>
              <Button type="submit" disabled={busy} className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                تأكيد التسليم
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* حوار الأسباب (تعذر/تأجيل/لم يرد/رفض) */}
      <Dialog open={Boolean(pending && !pending.isDelivery)} onOpenChange={(v) => !v && setPending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{pending?.label} — {o.orderNumber}</DialogTitle>
            <DialogDescription>
              {pending?.needsReason
                ? "يجب إدخال سبب واضح — تصل الإدارة إشعارًا فوريًا بهذه الحالة."
                : "سيتم تحديث الحالة وإشعار الإدارة."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitAction(new FormData(e.currentTarget));
            }}
            className="space-y-3 py-1"
          >
            <div className="space-y-1.5">
              <Label>
                السبب {pending?.needsReason && <span className="text-red-500">*</span>}
              </Label>
              <Textarea
                name="reason"
                rows={3}
                required={pending?.needsReason}
                placeholder={
                  pending?.status === "FAILED"
                    ? "مثال: العميل غير موجود في العنوان، ولا يرد على الهاتف"
                    : pending?.status === "POSTPONED"
                    ? "مثال: العميل طلب التسليم غدًا صباحًا"
                    : "اكتب ملاحظتك هنا..."
                }
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={busy} className="w-full gap-2">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                تأكيد
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { Banknote, durationLabel };
