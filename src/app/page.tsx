"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, navigate, useHashRoute, type Session } from "@/lib/client";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Boxes,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogIn,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { AdminApp } from "@/components/admin/AdminApp";
import { RepApp } from "@/components/rep/RepApp";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const route = useHashRoute();

  const loadSession = useCallback(async () => {
    try {
      const me = await apiFetch<{
        authenticated: boolean;
        role?: "ADMIN" | "REP";
        name?: string;
        repId?: number;
        email?: string;
      }>("/api/auth/me");
      if (me.authenticated && me.role) {
        setSession({ role: me.role, name: me.name ?? "", repId: me.repId, email: me.email });
        return true;
      }
      setSession(null);
      return false;
    } catch {
      setSession(null);
      return false;
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const logout = useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setSession(null);
    navigate("login");
  }, []);

  if (booting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/20 shadow-inner">
          <Boxes className="h-9 w-9 text-teal-300" />
        </div>
        <div className="text-center">
          <p className="text-3xl font-black tracking-widest text-white">NQEL</p>
          <p className="mt-1 text-sm text-teal-200/70">منصة إدارة التوصيل والعمليات</p>
        </div>
        <Spinner className="border-teal-300/30 border-t-teal-300" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onLogin={(s) => { setSession(s); navigate(s.role === "ADMIN" ? "admin/dashboard" : "rep/home"); }} />;
  }

  const seg = route.segments;
  if (session.role === "ADMIN") {
    return <AdminApp session={session} route={seg} logout={logout} />;
  }
  return <RepApp session={session} route={seg} logout={logout} />;
}

// ==================== شاشة تسجيل الدخول ====================

function LoginScreen({ onLogin }: { onLogin: (s: Session) => void }) {
  const [loading, setLoading] = useState<"admin" | "rep" | null>(null);
  const [showPass, setShowPass] = useState(false);

  async function loginAdmin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading("admin");
    try {
      const res = await apiFetch<{ role: "ADMIN"; name: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          mode: "admin",
          email: fd.get("email"),
          password: fd.get("password"),
        }),
      });
      onLogin({ role: "ADMIN", name: res.name, email: String(fd.get("email")) });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  async function loginRep(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading("rep");
    try {
      const res = await apiFetch<{ role: "REP"; name: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          mode: "rep",
          code: fd.get("code"),
          pin: fd.get("pin"),
        }),
      });
      onLogin({ role: "REP", name: res.name });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-teal-900 to-slate-900 lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* لوحة العلامة */}
      <div className="hidden flex-col justify-between p-12 lg:flex" dir="rtl">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/20">
            <Boxes className="h-7 w-7 text-teal-300" />
          </div>
          <div>
            <p className="text-2xl font-black tracking-widest text-white">NQEL</p>
            <p className="text-xs text-teal-200/70">Delivery & Operations Management</p>
          </div>
        </div>
        <div className="space-y-8">
          <h2 className="text-4xl font-black leading-snug text-white">
            تحكم كامل في طلباتك
            <br />
            <span className="text-teal-300">ومناديبك وأرباحك</span>
          </h2>
          <ul className="space-y-4 text-teal-100/80">
            {[
              ["إسناد ومتابعة الطلبات لحظيًا", <Truck key="t" className="h-5 w-5" />],
              ["لوحات إحصائية وتقارير أداء دقيقة", <ShieldCheck key="s" className="h-5 w-5" />],
              ["نظام مالي متكامل للإيرادات والمصروفات", <KeyRound key="k" className="h-5 w-5" />],
            ].map(([text, icon], i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/15 text-teal-300">
                  {icon as React.ReactNode}
                </span>
                <span className="text-base font-medium">{text as string}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-teal-200/50">منصة داخلية — للاستخدام الرسمي لفريق NQEL فقط</p>
      </div>

      {/* نموذج الدخول */}
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-8" dir="rtl">
        <div className="w-full max-w-md rounded-3xl bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-700 shadow-lg shadow-teal-700/30">
              <Boxes className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-widest text-teal-900">NQEL</h1>
            <p className="text-sm text-muted-foreground">تسجيل الدخول إلى المنصة</p>
          </div>

          <Tabs defaultValue="admin" dir="rtl">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="gap-1.5">
                <ShieldCheck className="h-4 w-4" />
                الإدارة
              </TabsTrigger>
              <TabsTrigger value="rep" className="gap-1.5">
                <Truck className="h-4 w-4" />
                المندوب
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <form onSubmit={loginAdmin} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    dir="ltr"
                    className="text-left"
                    placeholder="admin@nqel.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPass ? "text" : "password"}
                      dir="ltr"
                      className="pl-10 text-left"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="إظهار كلمة المرور"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
                  {loading === "admin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  دخول الإدارة
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="rep">
              <form onSubmit={loginRep} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">كود الدخول</Label>
                  <Input
                    id="code"
                    name="code"
                    dir="ltr"
                    className="text-center text-lg font-bold tracking-[0.3em] uppercase"
                    placeholder="NQ0000X"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">رمز PIN</Label>
                  <Input
                    id="pin"
                    name="pin"
                    type="password"
                    inputMode="numeric"
                    dir="ltr"
                    className="text-center text-lg font-bold tracking-[0.4em]"
                    placeholder="••••"
                    required
                  />
                </div>
                <Button type="submit" className="w-full gap-2" disabled={loading !== null}>
                  {loading === "rep" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                  دخول المندوب
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  كود الدخول ورمز PIN يتم إنشاؤهما من إدارة NQEL
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
