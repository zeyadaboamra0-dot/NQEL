"use client";

import { useState } from "react";
import { apiFetch, navigate, useApi, type RepRow } from "@/lib/client";
import { EmptyState, PageHeader, Spinner } from "@/components/shared";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, KeyRound, Loader2, MoreHorizontal, Plus, Search, UserPlus } from "lucide-react";

export function RepsView() {
  const { data, loading, refresh } = useApi<{ reps: RepRow[] }>("/api/reps");
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");

  const reps = data?.reps.filter(
    (r) => !q || r.name.includes(q) || r.code.includes(q) || (r.phone ?? "").includes(q)
  ) ?? [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="إدارة المناديب"
        subtitle={`عدد المناديب: ${data?.reps.length ?? 0}`}
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            إضافة مندوب
          </Button>
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو الكود أو الهاتف..." className="pr-9" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading && !data ? (
          <Spinner />
        ) : reps.length === 0 ? (
          <EmptyState title="لا يوجد مناديب" hint="أضف أول مندوب وسيحصل على كود دخول خاص" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">كود الدخول</TableHead>
                  <TableHead className="text-right">الطلبات</TableHead>
                  <TableHead className="text-right">نجاح التسليم</TableHead>
                  <TableHead className="text-right">الالتزام بالمواعيد</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-left"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reps.map((r) => (
                  <TableRow key={r.id} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`admin/reps/${r.id}`)}>
                    <TableCell>
                      <div className="font-bold">{r.name}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{r.phone ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-md bg-teal-50 px-2 py-1 font-mono text-sm font-bold text-teal-800" dir="ltr">{r.code}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-bold">{r.totalOrders ?? 0}</span>
                      <span className="text-muted-foreground"> ({r.deliveredCount ?? 0} مُسلّم)</span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-bold ${(r.successRate ?? 0) >= 70 ? "text-emerald-600" : (r.successRate ?? 0) >= 40 ? "text-amber-600" : "text-red-600"}`}>
                        {r.successRate ?? 0}%
                      </span>
                    </TableCell>
                    <TableCell className="text-sm font-semibold">{r.onTimeRate ?? 0}%</TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${r.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                        {r.active ? "مفعّل" : "موقوف"}
                      </span>
                    </TableCell>
                    <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu dir="rtl">
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="خيارات">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => navigate(`admin/reps/${r.id}`)}>
                            الملف والأداء
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              await apiFetch(`/api/reps/${r.id}`, { method: "PATCH", body: JSON.stringify({ active: !r.active }) });
                              toast.success(r.active ? "تم إيقاف الحساب" : "تم تفعيل الحساب");
                              refresh();
                            }}
                          >
                            {r.active ? "إيقاف الحساب" : "تفعيل الحساب"}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AddRepDialog open={addOpen} onOpenChange={setAddOpen} onCreated={refresh} />
    </div>
  );
}

function AddRepDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ code: string; name: string; pin: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pin = String(fd.get("pin"));
    if (pin.length < 6) {
      toast.error("رمز PIN يجب أن يكون 6 خانات على الأقل");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch<{ rep: { code: string; name: string } }>("/api/reps", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          phone: fd.get("phone"),
          governorate: fd.get("governorate"),
          city: fd.get("city"),
          vehicleType: fd.get("vehicleType"),
          code: fd.get("code"),
          pin,
          defaultCommission: Number(fd.get("defaultCommission")) || 0,
          notes: fd.get("notes"),
        }),
      });
      setCreated({ code: res.rep.code, name: res.rep.name, pin });
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function close() {
    setCreated(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!v && close())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-emerald-700">
                <KeyRound className="h-5 w-5" />
                تم إنشاء حساب المندوب
              </DialogTitle>
              <DialogDescription>
                سلّم المندوب بيانات الدخول التالية — لن تظهر كلمة المرور مرة أخرى:
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/50 p-4">
              <p className="text-lg font-extrabold">{created.name}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground">كود الدخول</span>
                <div className="flex items-center gap-2">
                  <code className="rounded-lg bg-white px-3 py-1.5 text-xl font-black tracking-widest text-teal-800" dir="ltr">{created.code}</code>
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(created.code); toast.success("تم نسخ الكود"); }} aria-label="نسخ الكود">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-muted-foreground">رمز PIN</span>
                <code className="rounded-lg bg-white px-3 py-1.5 text-xl font-black tracking-widest text-teal-800" dir="ltr">{created.pin}</code>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={close}>تم</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-teal-700" />
                إضافة مندوب جديد
              </DialogTitle>
              <DialogDescription>
                سيتم توليد كود دخول فريد تلقائيًا إذا تركت الحقل فارغًا. يُخزن رمز PIN مشفرًا ولا يمكن استعادته.
              </DialogDescription>
            </DialogHeader>
            <form id="add-rep-form" onSubmit={submit} className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>الاسم *</Label>
                <Input name="name" required placeholder="اسم المندوب" />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input name="phone" dir="ltr" inputMode="tel" className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label>المحافظة</Label>
                <Input name="governorate" />
              </div>
              <div className="space-y-1.5">
                <Label>المدينة</Label>
                <Input name="city" />
              </div>
              <div className="space-y-1.5">
                <Label>نوع المركبة</Label>
                <Input name="vehicleType" placeholder="دراجة / سيارة / فان" />
              </div>
              <div className="space-y-1.5">
                <Label>المستحق الافتراضي للطلب</Label>
                <Input name="defaultCommission" type="number" min="0" step="0.01" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label>كود الدخول (اختياري)</Label>
                <Input name="code" dir="ltr" className="text-left uppercase" placeholder="NQ0000X" />
              </div>
              <div className="space-y-1.5">
                <Label>رمز PIN *</Label>
                <Input name="pin" dir="ltr" inputMode="numeric" className="text-center text-lg font-bold tracking-[0.3em]" placeholder="••••••" required minLength={6} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>ملاحظات</Label>
                <Input name="notes" />
              </div>
              <DialogFooter className="col-span-full">
                <Button type="submit" disabled={saving} className="gap-1.5">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  إنشاء الحساب
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { Switch };
