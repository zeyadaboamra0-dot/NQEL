"use client";

import { useState } from "react";
import { apiFetch, navigate, useApi, type PayoutRow } from "@/lib/client";
import { EmptyState, PageHeader, Pagination, Spinner, StatCard } from "@/components/shared";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatDate, formatMoney } from "@/lib/constants";
import { Loader2, Wallet } from "lucide-react";

type Dues = {
  repId: number;
  repName: string;
  repCode: string;
  totalCommission: number;
  paid: number;
  remaining: number;
};

export function RepDuesView() {
  const [page, setPage] = useState(1);
  const [payFor, setPayFor] = useState<Dues | null>(null);
  const [saving, setSaving] = useState(false);
  const { data, loading, refresh } = useApi<{
    payouts: PayoutRow[];
    total: number;
    page: number;
    pageCount: number;
    dues: Dues[];
  }>(`/api/payouts?page=${page}&pageSize=15`);
  const { data: meta } = useApi<{ settings: { currency: string } }>("/api/meta");
  const currency = meta?.settings?.currency ?? "ج.م";

  const totals = data?.dues.reduce(
    (acc, d) => ({
      commission: acc.commission + d.totalCommission,
      paid: acc.paid + d.paid,
      remaining: acc.remaining + d.remaining,
    }),
    { commission: 0, paid: 0, remaining: 0 }
  );

  async function registerPayout(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!payFor) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiFetch("/api/payouts", {
        method: "POST",
        body: JSON.stringify({
          repId: payFor.repId,
          amount: Number(fd.get("amount")),
          note: fd.get("note"),
          advance: fd.get("advance") === "on",
        }),
      });
      toast.success(`تم تسجيل دفعة لـ ${payFor.repName}`);
      setPayFor(null);
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="مستحقات المناديب"
        subtitle="مستحقات كل مندوب من الطلبات المُسلّمة، المدفوع له، والمتبقي"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard title="إجمالي مستحقات المناديب" value={totals ? formatMoney(totals.commission, currency) : "—"} tone="teal" />
        <StatCard title="إجمالي المدفوع" value={totals ? formatMoney(totals.paid, currency) : "—"} tone="emerald" />
        <StatCard title="إجمالي المتبقي" value={totals ? formatMoney(totals.remaining, currency) : "—"} tone="amber" />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3 font-bold">حساب كل مندوب</div>
        {loading && !data ? (
          <Spinner />
        ) : !data || data.dues.length === 0 ? (
          <EmptyState title="لا يوجد مناديب مفعّلة" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">إجمالي المستحق</TableHead>
                  <TableHead className="text-right">المدفوع له</TableHead>
                  <TableHead className="text-right">المتبقي له</TableHead>
                  <TableHead className="text-left"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dues.map((d) => (
                  <TableRow key={d.repId} className="hover:bg-accent/40">
                    <TableCell>
                      <button className="font-bold text-teal-800 hover:underline" onClick={() => navigate(`admin/reps/${d.repId}`)}>
                        {d.repName}
                      </button>
                      <span className="block text-xs text-muted-foreground" dir="ltr">{d.repCode}</span>
                    </TableCell>
                    <TableCell className="font-bold">{formatMoney(d.totalCommission, currency)}</TableCell>
                    <TableCell className="text-emerald-700">{formatMoney(d.paid, currency)}</TableCell>
                    <TableCell className={`font-extrabold ${d.remaining > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {formatMoney(d.remaining, currency)}
                    </TableCell>
                    <TableCell className="text-left">
                      <Button size="sm" className="gap-1.5" onClick={() => setPayFor(d)}>
                        <Wallet className="h-4 w-4" />
                        تسجيل دفعة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b bg-muted/40 px-4 py-3 font-bold">سجل الدفعات</div>
        {loading && !data ? (
          <Spinner />
        ) : !data || data.payouts.length === 0 ? (
          <EmptyState title="لا توجد دفعات مسجلة" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">المندوب</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظة</TableHead>
                    <TableHead className="text-right">سجلت بواسطة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payouts.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-semibold">{p.rep?.name ?? "—"}</TableCell>
                      <TableCell className="font-bold">{formatMoney(p.amount, currency)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(p.payoutDate)}</TableCell>
                      <TableCell className="text-sm">{p.note ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.createdByName ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} />
          </>
        )}
      </div>

      <Dialog open={Boolean(payFor)} onOpenChange={(v) => !v && setPayFor(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تسجيل دفعة لـ {payFor?.repName}</DialogTitle>
            <DialogDescription>المتبقي له: {payFor ? formatMoney(payFor.remaining, currency) : ""}</DialogDescription>
          </DialogHeader>
          <form onSubmit={registerPayout} className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>المبلغ *</Label>
              <Input name="amount" type="number" min="0.01" step="0.01" required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label>ملاحظة</Label>
              <Input name="note" placeholder="مثال: دفعة نصف شهرية" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="advance" className="h-4 w-4 accent-teal-700" />
              سلفة (تتجاوز المستحق المتبقي)
            </label>
            <DialogFooter>
              <Button type="submit" disabled={saving} className="gap-1.5">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                حفظ الدفعة
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
