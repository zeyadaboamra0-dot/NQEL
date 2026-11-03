"use client";

import { useEffect, useState } from "react";
import { apiFetch, navigate, useApi, type OrderRow } from "@/lib/client";
import { EmptyState, PageHeader, Pagination, Spinner, StatusBadge, StatCard } from "@/components/shared";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { EXPENSE_CATEGORIES, formatDate, formatMoney } from "@/lib/constants";
import { Banknote, Loader2, Plus, Receipt, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";

type Expense = {
  id: number;
  title: string;
  category: string;
  amount: number;
  expenseDate: string;
  notes?: string;
  createdByName?: string;
};

export function FinanceView() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: dash } = useApi<{
    cards: {
      revenue: number; totalExpenses: number; operationalExpenses: number; orderExpenses: number;
      netProfit: number; collectedTotal: number; dueTotal: number; deliveredOrders: number;
    };
  }>("/api/stats/dashboard?days=365");
  const { data: ordersData, loading: ordersLoading } = useApi<{
    orders: OrderRow[]; total: number; page: number; pageCount: number;
  }>(`/api/orders?group=delivered&page=${page}&pageSize=12${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`);
  const { data: expensesData, refresh: refreshExpenses } = useApi<{
    expenses: Expense[]; totalAmount: number;
  }>(`/api/expenses?pageSize=8${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`);
  const { data: meta } = useApi<{ settings: { currency: string } }>("/api/meta");

  const currency = meta?.settings?.currency ?? "ج.م";
  const c = dash?.cards;

  async function addExpense(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiFetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          title: fd.get("title"),
          category: fd.get("category"),
          amount: Number(fd.get("amount")),
          expenseDate: fd.get("expenseDate"),
          notes: fd.get("notes"),
        }),
      });
      toast.success("تم تسجيل المصروف");
      setExpenseOpen(false);
      refreshExpenses();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteExpense(id: number) {
    try {
      await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
      toast.success("تم حذف المصروف");
      refreshExpenses();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="الإدارة المالية"
        subtitle="الإيرادات والمصروفات وصافي الأرباح — بدون احتساب أي تكلفة مرتين"
        actions={
          <Button className="gap-2" onClick={() => setExpenseOpen(true)}>
            <Plus className="h-4 w-4" />
            مصروف تشغيلي
          </Button>
        }
      />

      {/* الملخص المالي */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="إجمالي الإيرادات" value={c ? formatMoney(c.revenue, currency) : "—"} icon={<TrendingUp className="h-5 w-5" />} tone="teal" hint="من الطلبات المُسلّمة" />
        <StatCard title="تكاليف الطلبات" value={c ? formatMoney(c.orderExpenses, currency) : "—"} icon={<Receipt className="h-5 w-5" />} hint="مناديب + شحن + إضافي" />
        <StatCard title="مصروفات تشغيلية" value={c ? formatMoney(c.operationalExpenses, currency) : "—"} icon={<TrendingDown className="h-5 w-5" />} tone="amber" />
        <StatCard title="إجمالي المصروفات" value={c ? formatMoney(c.totalExpenses, currency) : "—"} icon={<Wallet className="h-5 w-5" />} tone="amber" />
        <StatCard title="صافي الربح" value={c ? formatMoney(c.netProfit, currency) : "—"} icon={<Banknote className="h-5 w-5" />} tone={c && c.netProfit >= 0 ? "emerald" : "red"} />
        <StatCard title="مبالغ غير محصلة" value={c ? formatMoney(c.dueTotal, currency) : "—"} tone={c && c.dueTotal > 0 ? "red" : "default"} hint={`محصل: ${c ? formatMoney(c.collectedTotal, currency) : ""}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* المالية لكل طلب */}
        <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
            <h3 className="font-bold">التفاصيل المالية للطلبات المُسلّمة</h3>
            <div className="flex gap-2">
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-8 w-[140px] text-xs" aria-label="من" />
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-8 w-[140px] text-xs" aria-label="إلى" />
            </div>
          </div>
          {ordersLoading && !ordersData ? (
            <Spinner />
          ) : !ordersData || ordersData.orders.length === 0 ? (
            <EmptyState title="لا توجد طلبات مُسلّمة في هذه الفترة" />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-right">الطلب</TableHead>
                      <TableHead className="text-right">التحصيل</TableHead>
                      <TableHead className="text-right">أجرة التوصيل</TableHead>
                      <TableHead className="text-right">مستحق المندوب</TableHead>
                      <TableHead className="text-right">تكاليف</TableHead>
                      <TableHead className="text-right">صافي الربح</TableHead>
                      <TableHead className="text-right">الحالة المالية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ordersData.orders.map((o) => (
                      <TableRow key={o.id} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`admin/orders/${o.id}`)}>
                        <TableCell className="font-bold text-teal-800">{o.orderNumber}</TableCell>
                        <TableCell>
                          {formatMoney(o.collectionAmount, currency)}
                          <span className={`block text-[11px] ${o.collectionCollected ? "text-emerald-600" : "text-amber-600"}`}>
                            {o.collectionCollected ? "محصل ✓" : "غير محصل"}
                          </span>
                        </TableCell>
                        <TableCell>{formatMoney(o.deliveryFee, currency)}</TableCell>
                        <TableCell>{formatMoney(o.repCommission, currency)}</TableCell>
                        <TableCell className="text-xs">
                          {formatMoney(o.shipmentCost + o.additionalExpenses, currency)}
                        </TableCell>
                        <TableCell className={`font-extrabold ${o.netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                          {formatMoney(o.netProfit, currency)}
                        </TableCell>
                        <TableCell><StatusBadge status={o.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Pagination page={ordersData.page} pageCount={ordersData.pageCount} onChange={setPage} />
            </>
          )}
        </div>

        {/* المصروفات التشغيلية */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
            <h3 className="font-bold">آخر المصروفات التشغيلية</h3>
            <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-sm font-bold text-amber-800">
              {expensesData ? formatMoney(expensesData.totalAmount, currency) : "—"}
            </span>
          </div>
          <div className="max-h-[420px] divide-y overflow-y-auto">
            {expensesData?.expenses.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">لا توجد مصروفات مسجلة</p>
            )}
            {expensesData?.expenses.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{ex.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ex.category} — {formatDate(ex.expenseDate)} {ex.createdByName ? `— ${ex.createdByName}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-bold text-amber-700">{formatMoney(ex.amount, currency)}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => deleteExpense(ex.id)} aria-label="حذف">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* حوار إضافة مصروف */}
      <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تسجيل مصروف تشغيلي</DialogTitle>
            <DialogDescription>
              يُضاف إلى إجمالي المصروفات في صافي الربح — يُسجل باسمك في سجل العمليات.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addExpense} className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>بيان المصروف *</Label>
              <Input name="title" required placeholder="مثال: وقود مركبات الأسبوع" />
            </div>
            <div className="space-y-1.5">
              <Label>التصنيف</Label>
              <Select name="category" defaultValue="عام">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input name="amount" type="number" min="0.01" step="0.01" required />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>التاريخ</Label>
              <Input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>ملاحظات</Label>
              <Input name="notes" />
            </div>
            <DialogFooter className="col-span-full">
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ المصروف
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
