"use client";

import { useEffect, useState } from "react";
import { apiFetch, useApi } from "@/lib/client";
import { PageHeader, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Save, Settings2, ShieldCheck, Truck, X } from "lucide-react";

type SettingsData = {
  platformName: string;
  currency: string;
  requireOtp: boolean;
  requireReceiverName: boolean;
  requireProof: boolean;
  lateThresholdHours: number;
  defaultCommission: number;
};

export function SettingsView() {
  const { data, loading, refresh } = useApi<{ settings: SettingsData }>("/api/settings");
  const { data: typesData, refresh: refreshTypes } = useApi<{ types: { id: number; name: string; active: boolean }[] }>(
    "/api/shipment-types"
  );
  const [form, setForm] = useState<SettingsData | null>(null);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(data.settings);
  }, [data, form]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await apiFetch("/api/settings", { method: "PATCH", body: JSON.stringify(form) });
      toast.success("تم حفظ الإعدادات");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function addType() {
    if (!newType.trim()) return;
    try {
      await apiFetch("/api/shipment-types", { method: "POST", body: JSON.stringify({ name: newType.trim() }) });
      toast.success("تمت إضافة النوع");
      setNewType("");
      refreshTypes();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggleType(id: number, active: boolean) {
    await apiFetch(`/api/shipment-types/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
    refreshTypes();
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setChangingPass(true);
    try {
      await apiFetch("/api/auth/change-credentials", {
        method: "POST",
        body: JSON.stringify({ current: fd.get("current"), next: fd.get("next") }),
      });
      toast.success("تم تغيير كلمة المرور");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChangingPass(false);
    }
  }

  if (loading && !data) return <Spinner />;
  if (!form) return null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="الإعدادات" subtitle="إعدادات المنصة وقواعد تأكيد التسليم وأنواع الشحنات" />

      {/* إعدادات عامة */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <Settings2 className="h-4 w-4 text-teal-700" />
          الإعدادات العامة
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>اسم المنصة</Label>
            <Input value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>رمز العملة</Label>
            <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>عمولة المندوب الافتراضية للطلب</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.defaultCommission}
              onChange={(e) => setForm({ ...form, defaultCommission: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>سماح التأخير بعد الموعد (ساعات)</Label>
            <Input
              type="number"
              min="0"
              value={form.lateThresholdHours}
              onChange={(e) => setForm({ ...form, lateThresholdHours: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">عدد الساعات المسموحة بعد الموعد قبل اعتبار الطلب متأخرًا</p>
          </div>
        </div>
      </div>

      {/* قواعد تأكيد التسليم */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <ShieldCheck className="h-4 w-4 text-teal-700" />
          قواعد تأكيد التسليم
        </h3>
        <div className="space-y-4">
          <ToggleRow
            title="إلزام رمز OTP"
            desc="لا يستطيع المندوب تسجيل الطلب كمُسلّم دون إدخال رمز التأكيد المعروض للعميل"
            checked={form.requireOtp}
            onChange={(v) => setForm({ ...form, requireOtp: v })}
          />
          <ToggleRow
            title="إلزام اسم المستلم"
            desc="يجب على المندوب إدخال اسم من استلم الشحنة فعليًا"
            checked={form.requireReceiverName}
            onChange={(v) => setForm({ ...form, requireReceiverName: v })}
          />
          <ToggleRow
            title="إلزام إثبات تسليم"
            desc="يجب إدخال وصف/مرجع كإثبات للتسليم (صورة رقم المندوب والعميل...)"
            checked={form.requireProof}
            onChange={(v) => setForm({ ...form, requireProof: v })}
          />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="w-full gap-2 sm:w-auto">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        حفظ الإعدادات
      </Button>

      {/* أنواع الشحنات */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <Truck className="h-4 w-4 text-teal-700" />
          أنواع الشحنات
        </h3>
        <div className="mb-4 flex gap-2">
          <Input
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            placeholder="نوع شحنة جديد..."
            onKeyDown={(e) => e.key === "Enter" && addType()}
          />
          <Button onClick={addType} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-center">مفعّل</TableHead>
                <TableHead className="text-left"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {typesData?.types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-semibold">{t.name}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={t.active} onCheckedChange={(v) => toggleType(t.id, v)} />
                  </TableCell>
                  <TableCell className="text-left">
                    {!t.active && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500"
                        onClick={async () => {
                          await apiFetch(`/api/shipment-types/${t.id}`, { method: "DELETE" });
                          toast.success("تم الحذف");
                          refreshTypes();
                        }}
                        aria-label="حذف"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          الأنواع المستخدمة في طلبات سابقة لا تُحذف نهائيًا بل تُوقف تلقائيًا حفاظًا على سلامة البيانات.
        </p>
      </div>

      {/* كلمة مرور الإدارة */}
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 font-bold">
          <ShieldCheck className="h-4 w-4 text-teal-700" />
          تغيير كلمة مرور الإدارة
        </h3>
        <form onSubmit={changePassword} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>كلمة المرور الحالية</Label>
            <Input name="current" type="password" dir="ltr" className="text-left" required />
          </div>
          <div className="space-y-1.5">
            <Label>كلمة المرور الجديدة</Label>
            <Input name="next" type="password" dir="ltr" className="text-left" required minLength={8} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" variant="outline" disabled={changingPass} className="gap-2">
              {changingPass && <Loader2 className="h-4 w-4 animate-spin" />}
              تغيير كلمة المرور
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
