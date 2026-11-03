import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity, requireFields, str } from "@/lib/services";
import type { Prisma } from "@prisma/client";

// GET /api/customers — قائمة العملاء مع إحصائياتهم
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = str(sp.get("q"));
    const type = str(sp.get("type")); // new | repeat
    const page = Math.max(1, Number(sp.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize")) || 15));

    const where: Prisma.CustomerWhereInput = {};
    if (type === "new" || type === "repeat") {
      const repeatRows = await db.order.groupBy({
        by: ["customerId"],
        _count: { _all: true },
        having: { customerId: { _count: { gt: 1 } } },
      });
      const repeatIds = repeatRows.map((r) => r.customerId);
      where.id = type === "repeat" ? { in: repeatIds } : { notIn: repeatIds };
    }
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }, { altPhone: { contains: q, mode: "insensitive" } }];

    const [total, customers] = await Promise.all([
      db.customer.count({ where }),
      db.customer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { orders: { select: { status: true, collectionAmount: true, collectionCollected: true, createdAt: true } } },
      }),
    ]);

    const list = customers.map((c) => {
      const delivered = c.orders.filter((o) => o.status === "DELIVERED");
      const cancelled = c.orders.filter((o) => o.status === "CANCELLED");
      const paidTotal = c.orders
        .filter((o) => o.collectionCollected)
        .reduce((s, o) => s + o.collectionAmount, 0);
      const dates = c.orders.map((o) => o.createdAt).sort((a, b) => a.getTime() - b.getTime());
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        altPhone: c.altPhone,
        governorate: c.governorate,
        city: c.city,
        address: c.address,
        notes: c.notes,
        createdAt: c.createdAt,
        totalOrders: c.orders.length,
        deliveredCount: delivered.length,
        cancelledCount: cancelled.length,
        paidTotal,
        firstOrderAt: dates[0] ?? null,
        lastOrderAt: dates[dates.length - 1] ?? null,
        isRepeat: c.orders.length > 1,
      };
    });

    return ok({ customers: list, total, page, pageSize, pageCount: Math.ceil(total / pageSize) || 1 });
  });
}

// POST /api/customers — إضافة عميل يدويًا
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const body = await req.json();
    requireFields(body, [
      ["name", "اسم العميل"],
      ["phone", "رقم الهاتف"],
    ]);
    const phone = String(body.phone).trim();
    const exists = await db.customer.findUnique({ where: { phone } });
    if (exists) throw new ApiError(400, "رقم الهاتف مسجل بالفعل للعميل: " + exists.name);

    const customer = await db.customer.create({
      data: {
        name: String(body.name).trim(),
        phone,
        altPhone: str(body.altPhone),
        governorate: str(body.governorate),
        city: str(body.city),
        address: str(body.address),
        notes: str(body.notes),
      },
    });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "CREATE",
      entityType: "CUSTOMER",
      entityId: customer.id,
      entityLabel: customer.name,
    });
    return ok({ customer }, 201);
  });
}
