"use client";

import { useEffect, useState } from "react";
import { navigate, useApi, type CustomerRow } from "@/lib/client";
import { EmptyState, PageHeader, Pagination, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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
import { formatDate, formatMoney } from "@/lib/constants";
import { ChevronLeft, Loader2, Phone, Search, UserPlus } from "lucide-react";

export function CustomersView() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const { data, loading, refresh } = useApi<{
    customers: CustomerRow[];
    total: number;
    page: number;
    pageCount: number;
  }>(`/api/customers?page=${page}&pageSize=15${appliedQ ? `&q=${encodeURIComponent(appliedQ)}` : ""}${type !== "all" ? `&type=${type}` : ""}`);

  useEffect(() => {
    const t = setTimeout(() => {
      setAppliedQ(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="إدارة العملاء"
        subtitle={`إجمالي ${data?.total ?? 0} عميل — يُربط الطلب تلقائيًا بالعميل عند تكرار رقم الهاتف`}
        actions={
          <Button className="gap-2" onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            إضافة عميل
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو رقم الهاتف..." className="pr-9" />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل العملاء</SelectItem>
            <SelectItem value="new">عملاء جدد</SelectItem>
            <SelectItem value="repeat">عملاء متكررون</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading && !data ? (
          <Spinner />
        ) : !data || data.customers.length === 0 ? (
          <EmptyState title="لا يوجد عملاء" hint="يُضاف العميل تلقائيًا عند إنشاء أول طلب، أو أضفه يدويًا" />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-right">الموقع</TableHead>
                  <TableHead className="text-right">الطلبات</TableHead>
                  <TableHead className="text-right">المدفوع</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">آخر طلب</TableHead>
                  <TableHead className="text-left"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.customers.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-accent/40" onClick={() => navigate(`admin/customers/${c.id}`)}>
                    <TableCell className="font-bold">{c.name}</TableCell>
                    <TableCell>
                      <a
                        href={`tel:${c.phone}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-teal-700 hover:underline"
                        dir="ltr"
                      >
                        <Phone className="h-3.5 w-3.5" /> {c.phone}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">{c.governorate ?? "—"} / {c.city ?? "—"}</TableCell>
                    <TableCell>
                      <span className="font-bold">{c.totalOrders ?? 0}</span>
                      <span className="text-xs text-muted-foreground"> ({c.deliveredCount ?? 0} ناجح، {c.cancelledCount ?? 0} ملغي)</span>
                    </TableCell>
                    <TableCell className="font-semibold">{formatMoney(c.paidTotal ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.isRepeat ? "bg-amber-100 text-amber-800" : "bg-teal-100 text-teal-800"}`}>
                        {c.isRepeat ? "متكرر" : "جديد"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(c.lastOrderAt)}</TableCell>
                    <TableCell className="text-left">
                      <Button variant="ghost" size="sm" className="gap-1 text-teal-700">
                        السجل
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {data && <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} />}

      <AddCustomerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => {
          refresh();
        }}
      />
    </div>
  );
}

function AddCustomerDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [saving, setSaving] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify({
          name: fd.get("name"),
          phone: fd.get("phone"),
          altPhone: fd.get("altPhone"),
          governorate: fd.get("governorate"),
          city: fd.get("city"),
          address: fd.get("address"),
          notes: fd.get("notes"),
        }),
      });
      toast.success("تمت إضافة العميل");
      onOpenChange(false);
      onCreated();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة عميل جديد</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 py-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>الاسم *</Label>
            <Input name="name" required />
          </div>
          <div className="space-y-1.5">
            <Label>رقم الهاتف *</Label>
            <Input name="phone" dir="ltr" className="text-left" required />
          </div>
          <div className="space-y-1.5">
            <Label>هاتف بديل</Label>
            <Input name="altPhone" dir="ltr" className="text-left" />
          </div>
          <div className="space-y-1.5">
            <Label>المحافظة</Label>
            <Input name="governorate" />
          </div>
          <div className="space-y-1.5">
            <Label>المدينة</Label>
            <Input name="city" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>العنوان</Label>
            <Input name="address" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>ملاحظات</Label>
            <Input name="notes" />
          </div>
          <DialogFooter className="col-span-full">
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
