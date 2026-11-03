"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, navigate, useApi } from "@/lib/client";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney, EGYPT_GOVERNORATES } from "@/lib/constants";
import { Banknote, CheckCircle2, Loader2, Save } from "lucide-react";

type Meta = {
  reps: { id: number; name: string; defaultCommission: number }[];
  shipmentTypes: { id: number; name: string }[];
  settings: { currency: string; defaultCommission: number };
};

export function OrderForm({ orderId }: { orderId?: number }) {
  const { data: meta } = useApi<Meta>("/api/meta");
  const [saving, setSaving] = useState(false);
  const { data: existingOrder } = useApi<{ order: Record<string, unknown> }>(
    orderId ? `/api/orders/${orderId}` : null
  );

  // تعبئة البيانات في وضع التعديل
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (orderId && existingOrder && !hydrated) {
      const o = existingOrder.order as Record<string, string | number | null>;
      setCustomerName(String(o.customer && (o.customer as { name?: string }).name || ""));
      setPhone(String(o.phone ?? ""));
      setAltPhone(String(o.altPhone ?? ""));
      setReceiverName(String(o.receiverName ?? ""));
      setGovernorate(String(o.governorate ?? ""));
      setCity(String(o.city ?? ""));
      setAddressDetail(String(o.addressDetail ?? ""));
      setMapLink(String(o.mapLink ?? ""));
      setPickupPlace(String(o.pickupPlace ?? ""));
      setDeliveryPlace(String(o.deliveryPlace ?? ""));
      setShipmentTypeId(o.shipmentTypeId ? String(o.shipmentTypeId) : "");
      setShipmentDesc(String(o.shipmentDesc ?? ""));
      setShipmentSize(String(o.shipmentSize ?? ""));
      setCollectionAmount(String(o.collectionAmount ?? 0));
      setDeliveryFee(String(o.deliveryFee ?? 0));
      setShipmentCost(String(o.shipmentCost ?? 0));
      setAdditionalExpenses(String(o.additionalExpenses ?? 0));
      setRepId(o.repId ? String(o.repId) : "none");
      setRepCommission(String(o.repCommission ?? 0));
      setExpectedDeliveryAt(o.expectedDeliveryAt ? String(o.expectedDeliveryAt).slice(0, 10) : "");
      setNotes(String(o.notes ?? ""));
      setExistingCustomer(o.customer as { name: string; phone: string } | null);
      setHydrated(true);
    }
  }, [existingOrder, hydrated, orderId]);

  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [governorate, setGovernorate] = useState("");
  const [city, setCity] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  const [mapLink, setMapLink] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [pickupPlace, setPickupPlace] = useState("");
  const [deliveryPlace, setDeliveryPlace] = useState("");
  const [shipmentTypeId, setShipmentTypeId] = useState("");
  const [shipmentDesc, setShipmentDesc] = useState("");
  const [shipmentSize, setShipmentSize] = useState("");
  const [collectionAmount, setCollectionAmount] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [shipmentCost, setShipmentCost] = useState("");
  const [additionalExpenses, setAdditionalExpenses] = useState("");
  const [repId, setRepId] = useState("none");
  const [repCommission, setRepCommission] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [notes, setNotes] = useState("");
  const [existingCustomer, setExistingCustomer] = useState<{ name: string; phone: string } | null>(null);

  // تعبئة تلقائية عند وسم عميل موجود برقم الهاتف
  useEffect(() => {
    const p = phone.trim();
    if (p.length < 6) {
      setExistingCustomer(null);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<{ customers: { id: number; name: string; phone: string; governorate?: string; city?: string; address?: string }[] }>(
        `/api/customers?q=${encodeURIComponent(p)}&pageSize=5`
      )
        .then((d) => {
          const found = d.customers.find((c) => c.phone === p);
          if (found) {
            setExistingCustomer(found);
            setCustomerName((prev) => prev || found.name);
            setGovernorate((prev) => prev || found.governorate || "");
            setCity((prev) => prev || found.city || "");
            setAddressDetail((prev) => prev || found.address || "");
          } else {
            setExistingCustomer(null);
          }
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [phone]);

  // عمولة المندوب الافتراضية عند اختياره
  useEffect(() => {
    if (repId !== "none" && meta) {
      const rep = meta.reps.find((r) => String(r.id) === repId);
      if (rep && !repCommission) {
        setRepCommission(String(rep.defaultCommission || meta.settings?.defaultCommission || 0));
      }
    }
  }, [repId]);

  const n = (v: string) => Number(v) || 0;
  const fin = useMemo(() => {
    const revenue = n(deliveryFee);
    const profit = revenue - n(shipmentCost) - n(additionalExpenses) - n(repCommission);
    return { revenue, profit };
  }, [deliveryFee, shipmentCost, additionalExpenses, repCommission]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerName.trim() || !phone.trim() || !governorate || !city.trim() || !addressDetail.trim() || !pickupPlace.trim() || !shipmentTypeId) {
      toast.error("أكمل الحقول المطلوبة: العميل، الهاتف، المحافظة، المدينة، العنوان، مكان الاستلام، نوع الشحنة");
      return;
    }
    setSaving(true);
    try {
      if (orderId) {
        await apiFetch<{ order: { id: number } }>(`/api/orders/${orderId}`, {
          method: "PATCH",
          body: JSON.stringify({
            customerName,
            phone,
            altPhone,
            receiverName,
            governorate,
            city,
            addressDetail,
            mapLink,
            pickupPlace,
            deliveryPlace,
            shipmentTypeId: Number(shipmentTypeId),
            shipmentDesc,
            shipmentSize,
            collectionAmount: n(collectionAmount),
            deliveryFee: n(deliveryFee),
            shipmentCost: n(shipmentCost),
            additionalExpenses: n(additionalExpenses),
            repCommission: n(repCommission),
            expectedDeliveryAt: expectedDeliveryAt || null,
            notes,
          }),
        });
        toast.success("تم حفظ التعديلات بنجاح");
        navigate(`admin/orders/${orderId}`);
        return;
      }
      const res = await apiFetch<{ order: { id: number; orderNumber: string } }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName,
          phone,
          altPhone,
          receiverName,
          governorate,
          city,
          addressDetail,
          mapLink,
          pickupPlace,
          deliveryPlace,
          shipmentTypeId: Number(shipmentTypeId),
          shipmentDesc,
          shipmentSize,
          collectionAmount: n(collectionAmount),
          deliveryFee: n(deliveryFee),
          shipmentCost: n(shipmentCost),
          additionalExpenses: n(additionalExpenses),
          repId: repId === "none" ? null : Number(repId),
          repCommission: n(repCommission),
          expectedDeliveryAt: expectedDeliveryAt || null,
          notes,
        }),
      });
      toast.success(`تم إنشاء الطلب ${res.order.orderNumber} بنجاح`);
      navigate(`admin/orders/${res.order.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title={orderId ? "تعديل بيانات الطلب" : "إضافة طلب جديد"}
        subtitle={orderId ? "سيُسجل التعديل في سجل العمليات مع القيم القديمة والجديدة" : "يُنشأ رقم الطلب تلقائيًا، وإن كان الهاتف مسجلًا سيتم ربط الطلب بالعميل الموجود"}
      />

      <form onSubmit={submit} className="space-y-5">
        {/* بيانات العميل */}
        <Section title="بيانات العميل" icon={<CheckCircle2 className="h-4 w-4" />}>
          {existingCustomer && (
            <div className="col-span-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              ✓ عميل موجود في قاعدة البيانات: {existingCustomer.name} — سيتم ربط الطلب به دون إنشاء عميل مكرر
            </div>
          )}
          <Field label="اسم العميل *" required>
            <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="الاسم الكامل" required />
          </Field>
          <Field label="رقم الهاتف *" required>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" inputMode="tel" className="text-left" placeholder="01xxxxxxxxx" required />
          </Field>
          <Field label="رقم هاتف بديل">
            <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} dir="ltr" inputMode="tel" className="text-left" />
          </Field>
          <Field label="اسم المستلم (إن وجد)">
            <Input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} />
          </Field>
          <Field label="المحافظة *" required>
            <Select value={governorate} onValueChange={setGovernorate}>
              <SelectTrigger>
                <SelectValue placeholder="اختر المحافظة" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {EGYPT_GOVERNORATES.map((g) => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="المدينة / المنطقة *" required>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="مثال: مدينة نصر" required />
          </Field>
          <Field label="العنوان بالتفصيل *" className="md:col-span-2" required>
            <Input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="الشارع، رقم العقار، الدور، علامة مميزة..." required />
          </Field>
          <Field label="رابط الموقع على Google Maps" className="md:col-span-2">
            <Input value={mapLink} onChange={(e) => setMapLink(e.target.value)} dir="ltr" className="text-left" placeholder="https://maps.google.com/..." />
          </Field>
        </Section>

        {/* الشحنة والتوصيل */}
        <Section title="الشحنة والتوصيل">
          <Field label="مكان استلام الشحنة *" required>
            <Input value={pickupPlace} onChange={(e) => setPickupPlace(e.target.value)} placeholder="اسم المتجر / المخزن / العنوان" required />
          </Field>
          <Field label="مكان تسليم الشحنة">
            <Input value={deliveryPlace} onChange={(e) => setDeliveryPlace(e.target.value)} placeholder="افتراضيًا: عنوان العميل" />
          </Field>
          <Field label="نوع الشحنة *" required>
            <Select value={shipmentTypeId} onValueChange={setShipmentTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر النوع" />
              </SelectTrigger>
              <SelectContent>
                {meta?.shipmentTypes?.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="حجم / وزن الشحنة">
            <Input value={shipmentSize} onChange={(e) => setShipmentSize(e.target.value)} placeholder="مثال: 5 كجم — صندوق متوسط" />
          </Field>
          <Field label="وصف الشحنة" className="md:col-span-2">
            <Textarea value={shipmentDesc} onChange={(e) => setShipmentDesc(e.target.value)} rows={2} placeholder="وصف مختصر لمحتويات الشحنة" />
          </Field>
          <Field label="الموعد المتوقع للتسليم">
            <Input type="date" value={expectedDeliveryAt} onChange={(e) => setExpectedDeliveryAt(e.target.value)} />
          </Field>
          <Field label="ملاحظات الطلب" className="md:col-span-2">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="أي تعليمات خاصة للمندوب..." />
          </Field>
        </Section>

        {/* المالية */}
        <Section title="البيانات المالية" icon={<Banknote className="h-4 w-4" />}>
          <Field label="قيمة التحصيل من العميل" hint="مبلغ COD — لا يُحتسب إيرادًا لـ NQEL">
            <Input type="number" min="0" step="0.01" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} />
          </Field>
          <Field label="أجرة التوصيل (إيراد NQEL)" hint="تُحتسب إيرادًا عند التسليم الناجح">
            <Input type="number" min="0" step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
          </Field>
          <Field label="تكلفة الشحنة على NQEL">
            <Input type="number" min="0" step="0.01" value={shipmentCost} onChange={(e) => setShipmentCost(e.target.value)} />
          </Field>
          <Field label="مصروفات إضافية على الطلب">
            <Input type="number" min="0" step="0.01" value={additionalExpenses} onChange={(e) => setAdditionalExpenses(e.target.value)} />
          </Field>
          <Field label="المندوب المسؤول">
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger>
                <SelectValue placeholder="بدون — سيظهر في «جديدة»" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون إسناد الآن</SelectItem>
                {meta?.reps?.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="مستحق المندوب">
            <Input type="number" min="0" step="0.01" value={repCommission} onChange={(e) => setRepCommission(e.target.value)} placeholder="0" />
          </Field>
          <div className="col-span-full flex flex-wrap gap-3 rounded-xl border border-teal-200 bg-teal-50/60 p-4">
            <div className="min-w-[140px]">
              <p className="text-xs text-muted-foreground">الإيراد الفعلي لـ NQEL</p>
              <p className="text-lg font-extrabold text-teal-800">{formatMoney(fin.revenue, meta?.settings?.currency)}</p>
            </div>
            <div className="min-w-[140px]">
              <p className="text-xs text-muted-foreground">صافي ربح الطلب المتوقع</p>
              <p className={`text-lg font-extrabold ${fin.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                {formatMoney(fin.profit, meta?.settings?.currency)}
              </p>
            </div>
            <p className="w-full text-[11px] text-muted-foreground">
              صافي الربح = أجرة التوصيل − تكلفة الشحنة − المصروفات الإضافية − مستحق المندوب (يُعتمد عند التسليم الفعلي)
            </p>
          </div>
        </Section>

        <div className="flex gap-3">
          <Button type="submit" size="lg" className="flex-1 gap-2 sm:flex-none" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الطلب
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate("admin/orders")}>
            إلغاء
          </Button>
        </div>
      </form>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 flex items-center gap-2 font-bold">
        {icon}
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  hint,
  required,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
