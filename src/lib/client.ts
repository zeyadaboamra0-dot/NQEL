"use client";

import { useCallback, useEffect, useState } from "react";

export class ClientError extends Error {}

export async function apiFetch<T = unknown>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options,
  });
  let json: Record<string, unknown> = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error((json.error as string) || `فشل الطلب (${res.status})`);
  }
  return json as T;
}

export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: Boolean(url),
    error: null,
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    // جميع التحديثات تتم داخل microtask لتجنب cascading renders
    Promise.resolve()
      .then(() => {
        if (alive) setState((s) => ({ ...s, loading: true, error: null }));
        return apiFetch<T>(url);
      })
      .then((d) => {
        if (alive) setState({ data: d, loading: false, error: null });
      })
      .catch((e: Error) => {
        if (alive) setState((s) => ({ ...s, loading: false, error: e.message }));
      });
    return () => {
      alive = false;
    };
  }, [url, tick, ...deps]);

  return {
    data: state.data,
    loading: state.loading && url !== null,
    error: state.error,
    refresh,
  };
}

// ==================== توجيه SPA عبر الهاش ====================

export type Route = { segments: string[] };

export function parseHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, "");
  const segments = h.split("/").filter(Boolean);
  return { segments };
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function useHashRoute(onChange?: (r: Route) => void) {
  const [route, setRoute] = useState<Route>({ segments: [] });
  useEffect(() => {
    const handler = () => {
      const r = parseHash();
      setRoute(r);
      onChange?.(r);
    };
    handler();
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  return route;
}

// ==================== أنواع مشتركة ====================

export type Session = {
  role: "ADMIN" | "REP";
  name: string;
  repId?: number;
  email?: string;
};

export type OrderRow = {
  id: number;
  orderNumber: string;
  status: string;
  phone: string;
  governorate: string;
  city: string;
  addressDetail: string;
  mapLink?: string | null;
  pickupPlace: string;
  deliveryPlace: string | null;
  collectionAmount: number;
  deliveryFee: number;
  shipmentCost: number;
  additionalExpenses: number;
  repCommission: number;
  nqelRevenue: number;
  netProfit: number;
  collectionCollected: boolean;
  attempts: number;
  notes?: string | null;
  shipmentDesc?: string | null;
  shipmentSize?: string | null;
  otpCode?: string | null;
  hasOtp?: boolean;
  receiverSigned?: string | null;
  deliveryProof?: string | null;
  failureReason?: string | null;
  postponeReason?: string | null;
  cancelReason?: string | null;
  expectedDeliveryAt: string | null;
  createdAt: string;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  closedAt?: string | null;
  customer?: { id: number; name: string; phone: string };
  rep?: { id: number; name: string } | null;
  shipmentType?: { name: string } | null;
  customerId?: number;
  repId?: number | null;
  createdByName?: string | null;
};

export type RepRow = {
  id: number;
  code: string;
  name: string;
  phone?: string | null;
  governorate?: string | null;
  city?: string | null;
  vehicleType?: string | null;
  active: boolean;
  defaultCommission: number;
  notes?: string | null;
  createdAt: string;
  totalOrders?: number;
  deliveredCount?: number;
  successRate?: number;
  onTimeRate?: number;
};

export type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  altPhone?: string | null;
  governorate?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  totalOrders?: number;
  deliveredCount?: number;
  cancelledCount?: number;
  paidTotal?: number;
  firstOrderAt?: string | null;
  lastOrderAt?: string | null;
  isRepeat?: boolean;
};

export type StatusHistoryRow = {
  id: number;
  status: string;
  note: string | null;
  actorType: string;
  actorName: string;
  createdAt: string;
};

export type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string;
  orderId: number | null;
  read: boolean;
  createdAt: string;
  order?: { orderNumber: string } | null;
};

export type ActivityRow = {
  id: number;
  actorType: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: number | null;
  entityLabel: string | null;
  details: string | null;
  createdAt: string;
};

export type PayoutRow = {
  id: number;
  repId: number;
  amount: number;
  note: string | null;
  payoutDate: string;
  createdByName?: string | null;
  rep?: { id: number; name: string; code: string };
};
