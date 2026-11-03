import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireRep, wrap } from "@/lib/api";
import { pageParams, str } from "@/lib/services";
import { FAILED_STATUSES, IN_PROGRESS_STATUSES, OPEN_STATUSES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

// GET /api/rep/orders — طلبات المندوب الحالي فقط + بطاقات العدّ
export async function GET(req: NextRequest) {
  return wrap(async () => {
    const rep = await requireRep();
    const sp = req.nextUrl.searchParams;
    const { skip, take, page, pageSize } = pageParams(sp, 20);
    const group = str(sp.get("group")); // new(assigned) | active | delivered | late | failed | all | history
    const q = str(sp.get("q"));

    const base: Prisma.OrderWhereInput = { repId: rep.id };
    const where: Prisma.OrderWhereInput = { ...base };
    if (group === "assigned") where.status = "ASSIGNED";
    else if (group === "active") where.status = { in: [...IN_PROGRESS_STATUSES, "POSTPONED"] };
    else if (group === "delivered") where.status = "DELIVERED";
    else if (group === "failed") where.status = { in: FAILED_STATUSES };
    else if (group === "history") where.status = { in: ["DELIVERED", ...FAILED_STATUSES, "CANCELLED"] };
    else if (group === "open") where.status = { in: OPEN_STATUSES };
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { receiverName: { contains: q, mode: "insensitive" } },
        { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [total, orders, counts] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }],
        skip,
        take,
        include: {
          customer: { select: { name: true, phone: true } },
          shipmentType: { select: { name: true } },
        },
      }),
      db.order.groupBy({
        by: ["status"],
        where: base,
        _count: { _all: true },
      }),
    ]);

    const lateOrders = await db.order.count({
      where: { ...base, status: { in: OPEN_STATUSES }, expectedDeliveryAt: { lt: new Date() } },
    });

    const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    return ok({
      orders,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize) || 1,
      cards: {
        assigned: countMap["ASSIGNED"] ?? 0,
        accepted: countMap["ACCEPTED"] ?? 0,
        onWayPickup: countMap["ON_WAY_PICKUP"] ?? 0,
        pickedUp: countMap["PICKED_UP"] ?? 0,
        onWayDelivery: countMap["ON_WAY_DELIVERY"] ?? 0,
        delivered: countMap["DELIVERED"] ?? 0,
        failed: FAILED_STATUSES.reduce((s, st) => s + (countMap[st] ?? 0), 0),
        postponed: countMap["POSTPONED"] ?? 0,
        late: lateOrders,
        total: counts.reduce((s, c) => s + c._count._all, 0),
      },
    });
  });
}
