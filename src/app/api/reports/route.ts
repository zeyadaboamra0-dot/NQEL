import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAdmin, wrap } from "@/lib/api";
import { round2, str, dayEnd, dayStart } from "@/lib/services";
import { FAILED_STATUSES } from "@/lib/constants";

// GET /api/reports — تقارير وإحصائيات مع فلاتر (فترة + مندوب + حالة)
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const from = str(sp.get("from"));
    const to = str(sp.get("to"));
    const repId = Number(sp.get("repId")) || undefined;
    const status = str(sp.get("status"));

    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = dayStart(from);
    if (to) {
      const end = dayEnd(to);
      range.lte = end;
    }
    const where: Record<string, unknown> = {};
    if (from || to) where.createdAt = range;
    if (repId) where.repId = repId;
    if (status) where.status = status;

    const orders = await db.order.findMany({
      where,
      include: {
        rep: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true } },
        shipmentType: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const delivered = orders.filter((o) => o.status === "DELIVERED");
    const failed = orders.filter((o) => FAILED_STATUSES.includes(o.status));

    // ملخص مالي للفترة
    const summary = {
      totalOrders: orders.length,
      delivered: delivered.length,
      failed: failed.length,
      successRate: orders.length ? Math.round((delivered.length / orders.length) * 100) : 0,
      revenue: round2(delivered.reduce((s, o) => s + o.nqelRevenue, 0)),
      repCommissions: round2(delivered.reduce((s, o) => s + o.repCommission, 0)),
      shipmentCosts: round2(delivered.reduce((s, o) => s + o.shipmentCost, 0)),
      additionalExpenses: round2(delivered.reduce((s, o) => s + o.additionalExpenses, 0)),
      netProfit: round2(delivered.reduce((s, o) => s + o.netProfit, 0)),
      collected: round2(orders.filter((o) => o.collectionCollected).reduce((s, o) => s + o.collectionAmount, 0)),
      uncollected: round2(
        delivered.filter((o) => !o.collectionCollected).reduce((s, o) => s + o.collectionAmount, 0)
      ),
    };

    // أداء كل مندوب في الفترة
    const byRep = new Map<number, { name: string; assigned: number; delivered: number; failed: number; onTime: number; revenue: number; commission: number }>();
    for (const o of orders) {
      if (!o.rep) continue;
      if (!byRep.has(o.rep.id)) byRep.set(o.rep.id, { name: o.rep.name, assigned: 0, delivered: 0, failed: 0, onTime: 0, revenue: 0, commission: 0 });
      const row = byRep.get(o.rep.id)!;
      row.assigned++;
      if (o.status === "DELIVERED") {
        row.delivered++;
        row.revenue += o.nqelRevenue;
        row.commission += o.repCommission;
        if (o.expectedDeliveryAt && o.deliveredAt && o.deliveredAt <= o.expectedDeliveryAt) row.onTime++;
      }
      if (FAILED_STATUSES.includes(o.status)) row.failed++;
    }

    // أفضل العملاء
    const byCustomer = new Map<number, { name: string; phone: string; orders: number; collected: number }>();
    for (const o of orders) {
      if (!byCustomer.has(o.customer.id)) byCustomer.set(o.customer.id, { name: o.customer.name, phone: o.customer.phone, orders: 0, collected: 0 });
      const row = byCustomer.get(o.customer.id)!;
      row.orders++;
      if (o.collectionCollected) row.collected += o.collectionAmount;
    }

    // سلسلة يومية
    const byDay = new Map<string, { date: string; orders: number; delivered: number; revenue: number }>();
    for (const o of orders) {
      const d = o.createdAt;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, { date: `${d.getMonth() + 1}/${d.getDate()}`, orders: 0, delivered: 0, revenue: 0 });
      const row = byDay.get(key)!;
      row.orders++;
      if (o.status === "DELIVERED") {
        row.delivered++;
        row.revenue += o.nqelRevenue;
      }
    }

    return ok({
      summary,
      repRows: [...byRep.values()].sort((a, b) => b.delivered - a.delivered),
      customerRows: [...byCustomer.values()].sort((a, b) => b.orders - a.orders).slice(0, 10),
      daily: [...byDay.values()].sort((a, b) => {
        const [am, ad] = a.date.split("/").map(Number);
        const [bm, bd] = b.date.split("/").map(Number);
        return am - bm || ad - bd;
      }),
      ordersCount: orders.length,
    });
  });
}
