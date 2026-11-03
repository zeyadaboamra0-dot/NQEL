"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  navigate,
  type Session,
} from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Bell,
  Boxes,
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  Users,
  Truck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dashboard } from "@/components/admin/Dashboard";
import { OrdersView } from "@/components/admin/OrdersView";
import { OrderForm } from "@/components/admin/OrderForm";
import { OrderDetail } from "@/components/admin/OrderDetail";
import { RepsView } from "@/components/admin/RepsView";
import { RepDetail } from "@/components/admin/RepDetail";
import { CustomersView } from "@/components/admin/CustomersView";
import { CustomerDetail } from "@/components/admin/CustomerDetail";
import { FinanceView } from "@/components/admin/FinanceView";
import { RepDuesView } from "@/components/admin/RepDuesView";
import { ReportsView } from "@/components/admin/ReportsView";
import { NotificationsView } from "@/components/admin/NotificationsView";
import { ActivityLogView } from "@/components/admin/ActivityLogView";
import { SettingsView } from "@/components/admin/SettingsView";

const NAV = [
  { key: "dashboard", label: "لوحة التحكم", icon: LayoutDashboard, path: "admin/dashboard" },
  { key: "orders", label: "إدارة الطلبات", icon: Package, path: "admin/orders" },
  { key: "reps", label: "المناديب", icon: Truck, path: "admin/reps" },
  { key: "customers", label: "العملاء", icon: Users, path: "admin/customers" },
  { key: "finance", label: "الإدارة المالية", icon: BadgeDollarSign, path: "admin/finance" },
  { key: "dues", label: "مستحقات المناديب", icon: Wallet, path: "admin/dues" },
  { key: "reports", label: "التقارير والإحصائيات", icon: BarChart3, path: "admin/reports" },
  { key: "notifications", label: "الإشعارات", icon: Bell, path: "admin/notifications" },
  { key: "activity", label: "سجل العمليات", icon: Activity, path: "admin/activity" },
  { key: "settings", label: "الإعدادات", icon: Settings, path: "admin/settings" },
];

export function AdminApp({
  session,
  route,
  logout,
}: {
  session: Session;
  route: string[];
  logout: () => void;
}) {
  const [unread, setUnread] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);

  const loadUnread = useCallback(() => {
    apiFetch<{ unread: number }>("/api/notifications?unread=1")
      .then((d) => setUnread(d.unread))
      .catch(() => {});
  }, []);

  const view = route[1] ?? "dashboard";
  const routeKey = route.join("/");

  useEffect(() => {
    loadUnread();
    const t = setInterval(loadUnread, 30000);
    return () => clearInterval(t);
  }, [loadUnread, routeKey]);

  const activeNav = useMemo(() => {
    if (view === "orders" && route[2] === "new") return "orders";
    return view;
  }, [view, route]);

  const content = useMemo(() => {
    switch (view) {
      case "dashboard":
        return <Dashboard />;
      case "orders":
        if (route[2] === "new") return <OrderForm />;
        if (route[2] && route[3] === "edit") return <OrderForm orderId={Number(route[2])} />;
        if (route[2]) return <OrderDetail orderId={Number(route[2])} />;
        return <OrdersView />;
      case "reps":
        if (route[2]) return <RepDetail repId={Number(route[2])} />;
        return <RepsView />;
      case "customers":
        if (route[2]) return <CustomerDetail customerId={Number(route[2])} />;
        return <CustomersView />;
      case "finance":
        return <FinanceView />;
      case "dues":
        return <RepDuesView />;
      case "reports":
        return <ReportsView />;
      case "notifications":
        return <NotificationsView onChanged={loadUnread} />;
      case "activity":
        return <ActivityLogView />;
      case "settings":
        return <SettingsView />;
      default:
        navigate("admin/dashboard");
        return null;
    }
  }, [view, routeKey, loadUnread]);

  const navList = (
    <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = activeNav === item.key;
        return (
          <button
            key={item.key}
            onClick={() => {
              navigate(item.path);
              setMobileNav(false);
            }}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-teal-500/20 text-teal-200 shadow-inner"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span>{item.label}</span>
            {item.key === "notifications" && unread > 0 && (
              <span className="mr-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/20">
        <Boxes className="h-6 w-6 text-teal-300" />
      </div>
      <div>
        <p className="text-lg font-black tracking-widest text-white">NQEL</p>
        <p className="text-[10px] text-teal-200/60">إدارة التوصيل والعمليات</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background" dir="rtl">
      {/* Sidebar - Desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar lg:flex">
        {brand}
        {navList}
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-300/80 transition-colors hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-[18px] w-[18px]" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Mobile nav drawer */}
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="right" className="w-72 bg-sidebar p-0 [&>button]:left-1 [&>button]:text-white">
          <SheetTitle className="sr-only">القائمة</SheetTitle>
          <div className="flex h-full flex-col">
            {brand}
            {navList}
            <div className="border-t border-sidebar-border p-3">
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-300/80"
              >
                <LogOut className="h-[18px] w-[18px]" />
                تسجيل الخروج
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card/90 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2">
            <Sheet open={mobileNav} onOpenChange={setMobileNav}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="القائمة">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
            </Sheet>
            <div className="hidden sm:block">
              <p className="text-sm font-bold">{session.name}</p>
              <p className="text-[11px] text-muted-foreground">صلاحيات الإدارة الكاملة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => navigate("admin/notifications")}
              aria-label="الإشعارات"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 && (
                <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Button>
            <Button
              className="hidden gap-2 sm:inline-flex"
              onClick={() => navigate("admin/orders/new")}
            >
              <ClipboardList className="h-4 w-4" />
              طلب جديد
            </Button>
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1 px-1.5" aria-label="الحساب">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                    {session.name.slice(0, 2)}
                  </div>
                  <ChevronLeft className="hidden h-3.5 w-3.5 sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>{session.name}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("admin/settings")}>
                  <Settings className="ml-2 h-4 w-4" />
                  الإعدادات
                </DropdownMenuItem>
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="ml-2 h-4 w-4" />
                  تسجيل الخروج
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 sm:p-6 lg:pb-6">{content}</main>
      </div>
    </div>
  );
}
