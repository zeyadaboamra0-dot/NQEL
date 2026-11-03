"use client";

import { useEffect, useState } from "react";
import { useApi, type ActivityRow } from "@/lib/client";
import { EmptyState, PageHeader, Pagination, Spinner } from "@/components/shared";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/constants";
import { Lock, Search } from "lucide-react";

const ENTITY_LABELS: Record<string, string> = {
  ORDER: "طلب",
  REP: "مندوب",
  CUSTOMER: "عميل",
  EXPENSE: "مصروف",
  PAYOUT: "دفعة",
  SETTINGS: "إعدادات",
  AUTH: "دخول",
  SHIPMENT_TYPE: "نوع شحنة",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "إنشاء",
  UPDATE: "تعديل",
  DELETE: "حذف",
  ASSIGN: "إسناد",
  REASSIGN: "إعادة إسناد",
  STATUS_CHANGE: "تغيير حالة",
  LOGIN: "تسجيل دخول",
  CHANGE_PIN: "تغيير PIN",
  CHANGE_PASSWORD: "تغيير كلمة المرور",
  RESET_PIN: "إعادة تعيين PIN",
  DEACTIVATE: "إيقاف",
  REGENERATE_OTP: "توليد OTP",
};

function DetailsCell({ details }: { details: string | null }) {
  if (!details) return <span>—</span>;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(details);
  } catch {
    return <span className="block max-w-[240px] truncate text-xs">{details}</span>;
  }
  const entries = Object.entries(parsed).slice(0, 4);
  if (entries.length === 0) return <span>—</span>;
  return (
    <div className="max-w-[280px] space-y-0.5 text-[11px] leading-relaxed">
      {entries.map(([k, v]) => {
        if (v && typeof v === "object" && "old" in (v as Record<string, unknown>)) {
          const { old, new: nw } = v as { old: unknown; new: unknown };
          return (
            <p key={k} className="truncate">
              <span className="font-bold">{k}:</span>{" "}
              <span className="text-red-600 line-through">{formatVal(old)}</span>{" "}
              <span className="text-emerald-700">{formatVal(nw)}</span>
            </p>
          );
        }
        return (
          <p key={k} className="truncate">
            <span className="font-bold">{k}:</span> {formatVal(v)}
          </p>
        );
      })}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "object") return "{...}";
  return String(v);
}

export function ActivityLogView() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [page, setPage] = useState(1);
  const { data, loading } = useApi<{
    logs: ActivityRow[];
    total: number;
    page: number;
    pageCount: number;
  }>(`/api/activity?page=${page}&pageSize=25${appliedQ ? `&q=${encodeURIComponent(appliedQ)}` : ""}${entityType !== "all" ? `&entityType=${entityType}` : ""}`);

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
        title="سجل العمليات"
        subtitle={`${data?.total ?? 0} عملية مسجلة — للقراءة فقط ولا يمكن لأحد تعديلها أو حذفها`}
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالاسم أو التفاصيل..." className="pr-9" />
        </div>
        <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        {loading && !data ? (
          <Spinner />
        ) : !data || data.logs.length === 0 ? (
          <EmptyState title="لا توجد عمليات مسجلة" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-right">الوقت</TableHead>
                    <TableHead className="text-right">المستخدم</TableHead>
                    <TableHead className="text-right">العملية</TableHead>
                    <TableHead className="text-right">العنصر</TableHead>
                    <TableHead className="text-right">التفاصيل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">{log.actorName}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {log.actorType === "ADMIN" ? "إدارة" : log.actorType === "REP" ? "مندوب" : "نظام"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          log.action === "DELETE" ? "bg-red-100 text-red-700"
                          : log.action === "CREATE" ? "bg-emerald-100 text-emerald-700"
                          : log.action === "STATUS_CHANGE" ? "bg-teal-100 text-teal-700"
                          : "bg-slate-100 text-slate-700"
                        }`}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {ENTITY_LABELS[log.entityType] ?? log.entityType}
                        {log.entityLabel && <span className="block text-xs font-bold text-teal-800">{log.entityLabel}</span>}
                      </TableCell>
                      <TableCell><DetailsCell details={log.details} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pagination page={data.page} pageCount={data.pageCount} onChange={setPage} />
          </>
        )}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        سجل محمي: تُسجل جميع العمليات تلقائيًا (من فعل، متى، القيم القديمة والجديدة) ولا تتيح الواجهة أي تعديل أو حذف.
      </p>
    </div>
  );
}
