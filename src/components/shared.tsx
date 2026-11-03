"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { ORDER_STATUS_LABELS, statusTone } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ReactNode as RN } from "react";

export function Spinner({ className }: { className?: string }) {
  return (
    <div className="flex justify-center py-10">
      <div
        className={cn(
          "h-8 w-8 animate-spin rounded-full border-4 border-primary/25 border-t-primary",
          className
        )}
        aria-label="جارٍ التحميل"
      />
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <Inbox className="h-10 w-10 text-muted-foreground/40" />
      <p className="font-semibold text-muted-foreground">{title}</p>
      {hint && <p className="text-sm text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        statusTone(status),
        className
      )}
    >
      {ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS] ?? status}
    </span>
  );
}

export function StatCard({
  title,
  value,
  icon,
  tone = "default",
  hint,
  onClick,
}: {
  title: string;
  value: RN;
  icon?: ReactNode;
  tone?: "default" | "teal" | "amber" | "emerald" | "red" | "violet" | "slate";
  hint?: string;
  onClick?: () => void;
}) {
  const tones: Record<string, string> = {
    default: "bg-card text-card-foreground",
    teal: "bg-teal-600/10 text-teal-800 border-teal-600/20",
    amber: "bg-amber-500/10 text-amber-800 border-amber-500/25",
    emerald: "bg-emerald-500/10 text-emerald-800 border-emerald-500/25",
    red: "bg-red-500/10 text-red-800 border-red-500/25",
    violet: "bg-violet-500/10 text-violet-800 border-violet-500/25",
    slate: "bg-slate-500/10 text-slate-800 border-slate-500/25",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-right shadow-sm transition-all",
        tones[tone],
        onClick && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
        !onClick && "cursor-default"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium opacity-75">{title}</p>
          <p className="mt-1 text-xl font-extrabold tracking-tight truncate">{value}</p>
          {hint && <p className="mt-1 text-[11px] opacity-70">{hint}</p>}
        </div>
        {icon && <div className="shrink-0 opacity-80">{icon}</div>}
      </div>
    </button>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronRight className="h-4 w-4" />
        السابق
      </Button>
      <span className="px-3 text-sm font-semibold">
        صفحة {page} من {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        التالي
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: RN }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed py-2 last:border-0">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-left text-sm font-semibold break-words">{value ?? "—"}</span>
    </div>
  );
}

export function KVCard({
  title,
  rows,
  className,
}: {
  title?: string;
  rows: [string, RN][];
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 shadow-sm", className)}>
      {title && <h3 className="mb-2 border-b pb-2 font-bold">{title}</h3>}
      <div className="space-y-0.5">
        {rows.map(([k, v]) => (
          <InfoRow key={k} label={k} value={v} />
        ))}
      </div>
    </div>
  );
}
