// ثوابت مشتركة بين العميل والخادم
import type { OrderStatus } from "@prisma/client";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: "جديد",
  ASSIGNED: "مُسند - بانتظار القبول",
  ACCEPTED: "تم استلام الطلب",
  ON_WAY_PICKUP: "في الطريق للاستلام",
  PICKED_UP: "تم استلام الشحنة",
  ON_WAY_DELIVERY: "في الطريق للعميل",
  DELIVERED: "تم التسليم",
  FAILED: "تعذر التسليم",
  NO_ANSWER: "العميل لم يرد",
  REFUSED: "رفض الاستلام",
  POSTPONED: "مؤجل",
  CANCELLED: "ملغى",
};

export const IN_PROGRESS_STATUSES: OrderStatus[] = [
  "ASSIGNED",
  "ACCEPTED",
  "ON_WAY_PICKUP",
  "PICKED_UP",
  "ON_WAY_DELIVERY",
];
export const FAILED_STATUSES: OrderStatus[] = ["FAILED", "NO_ANSWER", "REFUSED"];
export const OPEN_STATUSES: OrderStatus[] = [...IN_PROGRESS_STATUSES, "POSTPONED"];

export const REP_FLOW: Partial<Record<OrderStatus, { next: OrderStatus[] }>> = {
  ASSIGNED: { next: ["ACCEPTED"] },
  ACCEPTED: { next: ["ON_WAY_PICKUP"] },
  ON_WAY_PICKUP: { next: ["PICKED_UP", "FAILED", "POSTPONED"] },
  PICKED_UP: { next: ["ON_WAY_DELIVERY"] },
  ON_WAY_DELIVERY: {
    next: ["DELIVERED", "FAILED", "NO_ANSWER", "REFUSED", "POSTPONED"],
  },
};

// الحالات التي تُحتسب فيها مستحقات المندوب والإيرادات
export const REVENUE_STATUSES: OrderStatus[] = ["DELIVERED"];

export function statusTone(status: OrderStatus | string): string {
  switch (status) {
    case "NEW":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "ASSIGNED":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "ACCEPTED":
    case "ON_WAY_PICKUP":
    case "PICKED_UP":
    case "ON_WAY_DELIVERY":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "DELIVERED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "FAILED":
    case "NO_ANSWER":
    case "REFUSED":
      return "bg-red-50 text-red-700 border-red-200";
    case "POSTPONED":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "CANCELLED":
      return "bg-zinc-200 text-zinc-600 border-zinc-300";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export const EXPENSE_CATEGORIES = [
  "وقود",
  "صيانة مركبات",
  "رواتب إدارية",
  "إيجار",
  "اتصالات وإنترنت",
  "تغليف ومواد",
  "ضرائب ورسوم",
  "عام",
  "أخرى",
];

export const EGYPT_GOVERNORATES = [
  "القاهرة",
  "الجيزة",
  "الإسكندرية",
  "القليوبية",
  "الشرقية",
  "الدقهلية",
  "الغربية",
  "المنوفية",
  "البحيرة",
  "كفر الشيخ",
  "دمياط",
  "بورسعيد",
  "الإسماعيلية",
  "السويس",
  "شمال سيناء",
  "جنوب سيناء",
  "بني سويف",
  "الفيوم",
  "المنيا",
  "أسيوط",
  "سوهاج",
  "قنا",
  "الأقصر",
  "أسوان",
  "البحر الأحمر",
  "مطروح",
  "الوادي الجديد",
];

export function formatMoney(n: number | null | undefined, currency = "ج.م"): string {
  const v = Number(n ?? 0);
  return `${v.toLocaleString("ar-EG", { maximumFractionDigits: 2 })} ${currency}`;
}

export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Cairo",
    numberingSystem: "latn",
  }).format(date);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeZone: "Africa/Cairo",
    numberingSystem: "latn",
  }).format(date);
}

export function durationLabel(ms: number): string {
  if (!ms || ms < 0) return "—";
  const hours = ms / 3600000;
  if (hours < 1) return `${Math.round(ms / 60000)} دقيقة`;
  if (hours < 48) return `${hours.toFixed(1)} ساعة`;
  return `${Math.round(hours / 24)} يوم`;
}
