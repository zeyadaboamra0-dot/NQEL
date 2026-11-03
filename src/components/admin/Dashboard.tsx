"use client";

import { useCallback, useEffect, useState } from "react";
import { navigate, useApi } from "@/lib/client";
import { PageHeader, StatCard, Spinner, EmptyState } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  Package,
  RefreshCw,
  TrendingUp,
  Truck,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney } from "@/lib/constants";

type Dash = {
  cards: {
    totalOrders: number;
    newOrders: number;
    inProgressOrders: number;
    deliveredOrders: number;
    lateOrders: number;
    failedOrders: number;
    postponedOrders: number;
    cancelledOrders: number;
    totalCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    revenue: number;
    orderExpenses: number;
    operationalExpenses: number;
    totalExpenses: number;
    netProfit: number;
    collectedTotal: number;
    dueTotal: number;
    deliverySuccessRate: number;
  };
  series: { date: string; orders: number; delivered: number; revenue: number; profit: number }[];
  repPerformance: { id: number; name: string; active: boolean; assigned: number; delivered: number; failed: number; successRate: number; onTimeRate: number }[];
  statusSplit: { delivered: number; failed: number; inProgress: number; postponed: number; cancelled: number; new: number };
  customersSplit: { new: number; repeat: number };
  days: number;
  scope?: { operationalExpensesIncluded: boolean; note: string };
};

const COLORS = ["#0d9488", "#f59e0b", "#10b981", "#ef4444", "#64748b", "#8b5cf6"];

export function Dashboard() {
  const [days, setDays] = useState("30");
  const [repId, setRepId] = useState("0");
  const { data, loading, error, refresh } = useApi<Dash>(
    `/api/stats/dashboard?days=${days}${repId !== "0" ? `&repId=${repId}` : ""}`
  );
  const { data: meta } = useApi<{ reps: { id: number; name: string }[] }>("/api/meta");

  // تحديث تلقائي كل دقيقة
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (tick > 0) refresh();
  }, [tick, refresh]);

  const refreshAll = useCallback(() => {
    refresh();
    toast.success("تم تحديث البيانات");
  }, [refresh]);

  if (loading && !data) return <Spinner />;
  if (error) return <EmptyState title="تعذر تحميل الإحصائيات" hint={error} />;
  if (!data) return null;
  const c = data.cards;

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة التحكم"
        subtitle="نظرة شاملة على العمليات والأداء والمالية — تتحدث تلقائيًا"
        actions={
          <>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">آخر 7 أيام</SelectItem>
                <SelectItem value="30">آخر 30 يومًا</SelectItem>
                <SelectItem value="90">آخر 90 يومًا</SelectItem>
                <SelectItem value="365">آخر سنة</SelectItem>
              </SelectContent>
            </Select>
            <Select value={repId} onValueChange={setRepId}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="كل المناديب" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">كل المناديب</SelectItem>
                {meta?.reps?.map((r) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={refreshAll} aria-label="تحديث">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      <p className="-mt-3 text-xs text-muted-foreground">
        {data.scope?.note ?? "كل الأرقام محسوبة على الفترة والمندوب المختارين."}
      </p>

      {/* بطاقات الطلبات */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="إجمالي الطلبات" value={c.totalOrders} icon={<Package className="h-5 w-5" />} tone="teal" onClick={() => navigate("admin/orders")} />
        <StatCard title="طلبات جديدة" value={c.newOrders} icon={<Clock className="h-5 w-5" />} tone="violet" onClick={() => navigate("admin/orders")} />
        <StatCard title="قيد التنفيذ" value={c.inProgressOrders} icon={<TruckIcon />} tone="slate" />
        <StatCard title="تم التسليم" value={c.deliveredOrders} icon={<CheckCircle2 className="h-5 w-5" />} tone="emerald" />
        <StatCard title="متأخرة" value={c.lateOrders} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" onClick={() => navigate("admin/orders")} />
        <StatCard title="فاشلة / ملغاة" value={`${c.failedOrders + c.cancelledOrders}`} icon={<XCircle className="h-5 w-5" />} tone="red" />
      </div>

      {/* بطاقات العملاء والمالية */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="إجمالي العملاء" value={c.totalCustomers} icon={<Users className="h-5 w-5" />} onClick={() => navigate("admin/customers")} />
        <StatCard title="عملاء جدد (الفترة)" value={c.newCustomers} icon={<UserCheck className="h-5 w-5" />} hint={`متكررون: ${c.repeatCustomers}`} />
        <StatCard title="إجمالي الإيرادات" value={formatMoney(c.revenue)} icon={<DollarSign className="h-5 w-5" />} tone="teal" hint="من الطلبات المُسلّمة" />
        <StatCard title="إجمالي المصروفات" value={formatMoney(c.totalExpenses)} icon={<Wallet className="h-5 w-5" />} tone="amber" hint={`تشغيلية: ${formatMoney(c.operationalExpenses)}`} />
        <StatCard title="صافي الربح" value={formatMoney(c.netProfit)} icon={<TrendingUp className="h-5 w-5" />} tone={c.netProfit >= 0 ? "emerald" : "red"} />
        <StatCard title="نسبة نجاح التسليم" value={`${c.deliverySuccessRate}%`} icon={<CheckCircle2 className="h-5 w-5" />} hint={`محصل: ${formatMoney(c.collectedTotal)}`} />
      </div>

      {/* رسوم الطلبات والإيرادات */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="الطلبات اليومية (أُنشئت مقابل تُسلمت)">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.series} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="gOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0d9488" stopOpacity={0.7} />
                  <stop offset="100%" stopColor="#0d9488" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gDelivered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} />
              <Legend formatter={(v) => (v === "orders" ? "طلبات جديدة" : "تم تسليمها")} />
              <Area type="monotone" dataKey="orders" stroke="#0d9488" fill="url(#gOrders)" strokeWidth={2} />
              <Area type="monotone" dataKey="delivered" stroke="#f59e0b" fill="url(#gDelivered)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="الإيرادات وصافي الربح اليومي">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.series} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.65} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} formatter={(v) => formatMoney(Number(v))} />
              <Legend formatter={(v) => (v === "revenue" ? "الإيراد" : "صافي الربح")} />
              <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#gRev)" strokeWidth={2} />
              <Area type="monotone" dataKey="profit" stroke="#8b5cf6" fill="url(#gProfit)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* توزيع الحالات + أداء المناديب + العملاء */}
      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="توزيع حالات الطلبات">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: "مُسلّمة", value: data.statusSplit.delivered },
                  { name: "قيد التنفيذ", value: data.statusSplit.inProgress },
                  { name: "جديدة", value: data.statusSplit.new },
                  { name: "فاشلة", value: data.statusSplit.failed },
                  { name: "مؤجلة", value: data.statusSplit.postponed },
                  { name: "ملغاة", value: data.statusSplit.cancelled },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
                label={(e: { name?: string; value?: number }) => `${e.name}: ${e.value}`}
                labelLine={false}
                style={{ fontSize: 11 }}
              >
                {COLORS.map((color, i) => (
                  <Cell key={i} fill={color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="أداء المناديب (طلبات مُسلّمة)">
          {data.repPerformance.length === 0 ? (
            <EmptyState title="لا يوجد مناديب بعد" hint="أضف مندوبًا من صفحة المناديب" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.repPerformance} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} />
                <Legend formatter={(v) => (v === "delivered" ? "مُسلّمة" : "فاشلة")} />
                <Bar dataKey="delivered" fill="#0d9488" radius={[6, 6, 0, 0]} />
                <Bar dataKey="failed" fill="#ef4444" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="العملاء الجدد مقابل المتكررين">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={[
                  { name: "عملاء جدد", value: data.customersSplit.new },
                  { name: "عملاء متكررون", value: data.customersSplit.repeat },
                ]}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={4}
                label={(e: { name?: string; value?: number }) => `${e.name}: ${e.value}`}
                style={{ fontSize: 11 }}
              >
                <Cell fill="#0d9488" />
                <Cell fill="#f59e0b" />
              </Pie>
              <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function TruckIcon() {
  return <Truck className="h-5 w-5" />;
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="mb-3 font-bold">{title}</h3>
      {children}
    </div>
  );
}
