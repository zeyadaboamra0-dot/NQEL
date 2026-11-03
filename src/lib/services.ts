// خدمات الأعمال: الحسابات المالية، سجل العمليات، الإشعارات، أدوات الطلبات
import { randomInt, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { IN_PROGRESS_STATUSES, OPEN_STATUSES } from "@/lib/constants";
import type { OrderStatus } from "@prisma/client";

// ==================== المالية ====================

export type FinancialInput = {
  deliveryFee: number;
  shipmentCost: number;
  additionalExpenses: number;
  repCommission: number;
};

export function computeFinancials(input: FinancialInput) {
  const nqelRevenue = round2(input.deliveryFee);
  const netProfit = round2(
    nqelRevenue - input.shipmentCost - input.additionalExpenses - input.repCommission
  );
  return { nqelRevenue, netProfit };
}

export function round2(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// ==================== رقم الطلب ====================

// رقم مؤقت فريد يُستبدل برقم مبني على المعرّف داخل نفس العملية
export function tempOrderNumber() {
  return `TMP-${randomUUID()}`;
}

// رقم الطلب مبني على معرّف الطلب نفسه (فريد بالتصميم حتى مع الطلبات المتزامنة)
export function orderNumberFromId(id: number) {
  const year = new Date().getFullYear();
  return `NQ-${year}-${String(id).padStart(5, "0")}`;
}

export const OTP_MAX_ATTEMPTS = 5;
export const OTP_TTL_MS = 24 * 3600 * 1000;

// عمولة المندوب: عمولته الخاصة إن وُجدت وإلا العمولة الافتراضية العامة
export function resolveRepCommission(
  rep: { defaultCommission: number } | null | undefined,
  settings: { defaultCommission: number } | null | undefined
) {
  if (rep && rep.defaultCommission > 0) return round2(rep.defaultCommission);
  return round2(settings?.defaultCommission ?? 0);
}

export function generateOtp() {
  return String(randomInt(100000, 1000000));
}

// ==================== الحالات ====================

export function isOpenStatus(status: OrderStatus) {
  return OPEN_STATUSES.includes(status);
}

export function isInProgress(status: OrderStatus) {
  return IN_PROGRESS_STATUSES.includes(status);
}

export function isLate(order: { status: OrderStatus; expectedDeliveryAt: Date | null }, thresholdHours = 0) {
  if (!order.expectedDeliveryAt) return false;
  if (!OPEN_STATUSES.includes(order.status)) return false;
  const deadline = new Date(order.expectedDeliveryAt.getTime() + thresholdHours * 3600000);
  return Date.now() > deadline.getTime();
}

// ==================== سجل العمليات ====================

export type LogInput = {
  actorType: "ADMIN" | "REP" | "SYSTEM";
  actorId?: number | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: number | null;
  entityLabel?: string | null;
  details?: unknown;
};

export async function logActivity(input: LogInput) {
  try {
    await db.activityLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        entityLabel: input.entityLabel ?? null,
        details: input.details ? JSON.stringify(input.details) : null,
      },
    });
  } catch (e) {
    console.error("[logActivity]", e);
  }
}

export function diffFields<T extends Record<string, unknown>>(oldObj: T, newObj: Record<string, unknown>, fields: string[]) {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  for (const f of fields) {
    const a = oldObj?.[f];
    const b = newObj[f];
    const norm = (v: unknown) => (v === undefined || v === null ? "" : typeof v === "number" ? v : String(v));
    if (norm(a) !== norm(b)) changes[f] = { old: a ?? null, new: b ?? null };
  }
  return changes;
}

// ==================== الإشعارات ====================

export type NotifyInput = {
  targetType: "ADMIN" | "REP";
  repId?: number | null;
  type: string;
  title: string;
  body: string;
  orderId?: number | null;
};

export async function notify(input: NotifyInput) {
  try {
    await db.notification.create({
      data: {
        targetType: input.targetType,
        repId: input.targetType === "REP" ? (input.repId ?? null) : null,
        type: input.type,
        title: input.title,
        body: input.body,
        orderId: input.orderId ?? null,
      },
    });
  } catch (e) {
    console.error("[notify]", e);
  }
}

export async function notifyAdmins(input: Omit<NotifyInput, "targetType" | "repId">) {
  await notify({ ...input, targetType: "ADMIN" });
}

// ==================== تحقق من المدخلات ====================

export function requireFields(body: Record<string, unknown>, fields: [string, string][]) {
  const missing: string[] = [];
  for (const [key, label] of fields) {
    const v = body[key];
    if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) {
      missing.push(label);
    }
  }
  if (missing.length) throw new ApiError(400, `الحقول المطلوبة مفقودة: ${missing.join("، ")}`);
}

export function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// تحويل "YYYY-MM-DD" إلى بداية اليوم بالتوقيت المحلي (يمنع إزاحة التوقيت)
export function dayStart(v: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v);
  if (Number.isNaN(d.getTime())) throw new ApiError(400, "تاريخ غير صحيح");
  return d;
}

export function dayEnd(v: string): Date {
  const d = dayStart(v);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function validDate(v: unknown, label = "التاريخ"): Date {
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) throw new ApiError(400, `${label} غير صحيح`);
  return d;
}

export function pageParams(searchParams: URLSearchParams, defaultSize = 20) {
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || defaultSize));
  return { skip: (page - 1) * pageSize, take: pageSize, page, pageSize };
}
