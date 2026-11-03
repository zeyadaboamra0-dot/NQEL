"use client";

import { useState } from "react";
import { useApi } from "@/lib/client";
import { EmptyState, PageHeader, Spinner, StatCard } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatMoney } from "@/lib/constants";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/admin/Dashboard";

type ReportData = {
  summary: {
    totalOrders: number;
    delivered: number;
    failed: number;
    successRate: number;
    revenue: number;
    repCommissions: number;
    shipmentCosts: number;
    additionalExpenses: number;
    netProfit: number;
    collected: number;
    uncollected: number;
  };
  repRows: { name: string; assigned: number; delivered: number; failed: number; onTime: number; revenue: number; commission: number }[];
  customerRows: { name: string; phone: string; orders: number; collected: number }[];
  daily: { date: string; orders: number; delivered: number; revenue: number }[];
  ordersCount: number;
};

export function ReportsView() {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [repId, setRepId] = useState("0");

  const { data, loading } = useApi<ReportData>(
    `/api/reports?from=${from}&to=${to}${repId !== "0" ? `&repId=${repId}` : ""}`
  );
  const { data: meta } = useApi<{ reps: { id: number; name: string }[]; settings: { currency: string } }>("/api/meta");
  const currency = meta?.settings?.currency ?? "ج.م";

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["التقرير المالي", `${from} إلى ${to}`],
      [],
      ["إجمالي الطلبات", data.summary.totalOrders],
      ["مُسلّمة", data.summary.delivered],
      ["فاشلة", data.summary.failed],
      ["نسبة النجاح %", data.summary.successRate],
      ["الإيرادات", data.summary.revenue],
      ["مستحقات المناديب", data.summary.repCommissions],
      ["تكاليف الشحن", data.summary.shipmentCosts],
      ["مصروفات إضافية", data.summary.additionalExpenses],
      ["صافي الربح", data.summary.netProfit],
      ["محصل", data.summary.collected],
      ["غير محصل", data.summary.uncollected],
      [],
      ["أداء المناديب"],
      ["المندوب", "مسندة", "مُسلّمة", "فاشلة", "في الموعد", "إيراد", "مستحق"],
      ...data.repRows.map((r) => [r.name, r.assigned, r.delivered, r.failed, r.onTime, r.revenue, r.commission]),
    ];
    const csv = "\uFEFF" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NQEL-report-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل التقرير CSV");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="التقارير والإحصائيات"
        subtitle="أداء الفترة المحددة مع فلاتر المندوب والحالة — قابل للتصدير"
        actions={
          <Button variant="outline" className="gap-2" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            تصدير CSV
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-3">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" aria-label="من" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" aria-label="إلى" />
        <Select value={repId} onValueChange={setRepId}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="كل المناديب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">كل المناديب</SelectItem>
            {meta?.reps?.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : !data ? (
        <EmptyState title="لا توجد بيانات" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            <StatCard title="طلبات الفترة" value={data.summary.totalOrders} tone="teal" />
            <StatCard title="مُسلّمة" value={data.summary.delivered} tone="emerald" />
            <StatCard title="فاشلة" value={data.summary.failed} tone="red" />
            <StatCard title="نسبة النجاح" value={`${data.summary.successRate}%`} tone="teal" />
            <StatCard title="الإيرادات" value={formatMoney(data.summary.revenue, currency)} tone="teal" />
            <StatCard title="صافي الربح" value={formatMoney(data.summary.netProfit, currency)} tone={data.summary.netProfit >= 0 ? "emerald" : "red"} hint={`مستحقات مناديب: ${formatMoney(data.summary.repCommissions, currency)}`} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard title="حركة الطلبات اليومية">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} />
                  <Legend formatter={(v) => (v === "orders" ? "أُنشئت" : "مُسلّمة")} />
                  <Bar dataKey="orders" fill="#0d9488" radius={[4, 4, 0, 0]} name="orders" />
                  <Bar dataKey="delivered" fill="#f59e0b" radius={[4, 4, 0, 0]} name="delivered" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="الإيراد اليومي">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12, fontSize: 13 }} formatter={(v) => formatMoney(Number(v), currency)} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {/* أداء المناديب */}
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b bg-muted/40 px-4 py-3 font-bold">أداء المناديب في الفترة</div>
              {data.repRows.length === 0 ? (
                <EmptyState title="لا توجد بيانات مناديب" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">المندوب</TableHead>
                        <TableHead className="text-right">مسندة</TableHead>
                        <TableHead className="text-right">مُسلّمة</TableHead>
                        <TableHead className="text-right">فاشلة</TableHead>
                        <TableHead className="text-right">في الموعد</TableHead>
                        <TableHead className="text-right">مستحق</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.repRows.map((r) => (
                        <TableRow key={r.name}>
                          <TableCell className="font-bold">{r.name}</TableCell>
                          <TableCell>{r.assigned}</TableCell>
                          <TableCell className="font-semibold text-emerald-700">{r.delivered}</TableCell>
                          <TableCell className="text-red-600">{r.failed}</TableCell>
                          <TableCell>{r.delivered ? Math.round((r.onTime / r.delivered) * 100) : 0}%</TableCell>
                          <TableCell className="font-semibold">{formatMoney(r.commission, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* أفضل العملاء */}
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="border-b bg-muted/40 px-4 py-3 font-bold">أكثر 10 عملاء نشاطًا</div>
              {data.customerRows.length === 0 ? (
                <EmptyState title="لا توجد بيانات عملاء" />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">الهاتف</TableHead>
                        <TableHead className="text-right">الطلبات</TableHead>
                        <TableHead className="text-right">إجمالي المحصل</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customerRows.map((c) => (
                        <TableRow key={c.phone}>
                          <TableCell className="font-bold">{c.name}</TableCell>
                          <TableCell dir="ltr" className="text-right text-sm">{c.phone}</TableCell>
                          <TableCell className="font-semibold">{c.orders}</TableCell>
                          <TableCell>{formatMoney(c.collected, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
