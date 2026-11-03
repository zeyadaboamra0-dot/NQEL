"use client";

import { useState } from "react";
import { apiFetch, type Session } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/shared";
import { toast } from "sonner";
import { useApi } from "@/lib/client";
import { KeyRound, Loader2, LogOut, Save, Truck } from "lucide-react";

type RepProfileData = {
  rep: {
    id: number;
    code: string;
    name: string;
    phone?: string | null;
    governorate?: string | null;
    city?: string | null;
    vehicleType?: string | null;
  };
};

export function RepProfile({ session, logout }: { session: Session; logout: () => void }) {
  const { data, loading, refresh } = useApi<RepProfileData>("/api/rep/profile");
  const [saving, setSaving] = useState(false);
  const [changingPin, setChangingPin] = useState(false);

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiFetch("/api/rep/profile", { method: "PATCH", body: JSON.stringify({ phone: fd.get("phone") }) });
      toast.success("تم تحديث رقم هاتفك");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changePin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setChangingPin(true);
    try {
      await apiFetch("/api/auth/change-credentials", {
        method: "POST",
        body: JSON.stringify({ current: fd.get("current"), next: fd.get("next") }),
      });
      toast.success("تم تغيير رمز PIN بنجاح");
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setChangingPin(false);
    }
  }

  if (loading && !data) return <Spinner />;
  const rep = data?.rep;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold">الملف الشخصي</h1>

      {/* بطاقة الحساب */}
      <div className="rounded-2xl bg-gradient-to-l from-teal-800 to-teal-700 p-5 text-white shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15 text-lg font-black">
            {session.name.slice(0, 2)}
          </div>
          <div>
            <p className="text-lg font-black">{session.name}</p>
            <p className="flex items-center gap-1.5 text-sm text-teal-200/90">
              <Truck className="h-4 w-4" />
              مندوب توصيل
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-white/10 p-3 text-center">
          <p className="text-xs text-teal-200/80">كود الدخول الخاص بك</p>
          <p className="mt-0.5 font-mono text-2xl font-black tracking-[0.25em]">{rep?.code ?? "—"}</p>
        </div>
      </div>

      {/* بيانات المندوب */}
      <form onSubmit={saveProfile} className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 font-bold">بياناتك</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الاسم</Label>
            <Input value={rep?.name ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهاتف (يمكنك تعديله)</Label>
            <Input name="phone" dir="ltr" inputMode="tel" className="text-left" defaultValue={rep?.phone ?? ""} />
          </div>
          <div className="space-y-1.5">
            <Label>المحافظة</Label>
            <Input value={rep?.governorate ?? "—"} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>المركبة</Label>
            <Input value={rep?.vehicleType ?? "—"} disabled />
          </div>
        </div>
        <Button type="submit" disabled={saving} className="mt-4 gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          حفظ
        </Button>
      </form>

      {/* تغيير PIN */}
      <form onSubmit={changePin} className="rounded-xl border bg-card p-4 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-bold">
          <KeyRound className="h-4 w-4 text-teal-700" />
          تغيير رمز PIN
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>رمز PIN الحالي</Label>
            <Input name="current" type="password" dir="ltr" inputMode="numeric" className="text-center tracking-[0.3em]" required />
          </div>
          <div className="space-y-1.5">
            <Label>رمز PIN الجديد</Label>
            <Input name="next" type="password" dir="ltr" inputMode="numeric" className="text-center tracking-[0.3em]" required minLength={6} />
          </div>
        </div>
        <Button type="submit" variant="outline" disabled={changingPin} className="mt-4 gap-2">
          {changingPin && <Loader2 className="h-4 w-4 animate-spin" />}
          تغيير الرمز
        </Button>
      </form>

      <Button
        onClick={logout}
        variant="outline"
        className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50"
      >
        <LogOut className="h-4 w-4" />
        تسجيل الخروج
      </Button>
    </div>
  );
}
