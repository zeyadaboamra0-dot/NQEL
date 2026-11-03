import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import {
  computeFinancials,
  generateOtp,
  orderNumberFromId,
  resolveRepCommission,
  tempOrderNumber,
  logActivity,
  notify,
  num,
  pageParams,
  requireFields,
  round2,
  str,
  dayEnd,
  dayStart,
} from "@/lib/services";
import { FAILED_STATUSES, IN_PROGRESS_STATUSES, OPEN_STATUSES } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

// GET /api/orders — قائمة الطلبات مع فلاتر وبحث وترقيم صفحات
export async function GET(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const { skip, take, page, pageSize } = pageParams(sp, 15);
    const q = str(sp.get("q"));
    const status = str(sp.get("status"));
    const group = str(sp.get("group")); // new | in_progress | delivered | late | failed | cancelled | postponed | open
    const repId = num(sp.get("repId"), 0);
    const customerId = num(sp.get("customerId"), 0);
    const from = str(sp.get("from"));
    const to = str(sp.get("to"));

    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status as Prisma.EnumOrderStatusFilter["equals"];
    if (group) {
      if (group === "new") where.status = "NEW";
      else if (group === "open") where.status = { in: OPEN_STATUSES };
      else if (group === "in_progress") where.status = { in: IN_PROGRESS_STATUSES };
      else if (group === "delivered") where.status = "DELIVERED";
      else if (group === "failed") where.status = { in: FAILED_STATUSES };
      else if (group === "postponed") where.status = "POSTPONED";
      else if (group === "cancelled") where.status = "CANCELLED";
    }
    const late = sp.get("late") === "1" || group === "late";
    if (late) {
      const threshold = (await db.settings.findUnique({ where: { id: 1 } }))?.lateThresholdHours ?? 0;
      where.status = { in: OPEN_STATUSES };
      where.expectedDeliveryAt = { lt: new Date(Date.now() - threshold * 3600000) };
    }
    if (repId) where.repId = repId;
    if (customerId) where.customerId = customerId;
    if (from || to) {
      where.createdAt = {};
      if (from) (where.createdAt as Prisma.DateTimeFilter).gte = dayStart(from);
      if (to) {
        const end = dayEnd(to);
        (where.createdAt as Prisma.DateTimeFilter).lte = end;
      }
    }
    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { receiverName: { contains: q, mode: "insensitive" } },
        { customer: { is: { name: { contains: q, mode: "insensitive" } } } },
        { customer: { is: { phone: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const [total, orders] = await Promise.all([
      db.order.count({ where }),
      db.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          rep: { select: { id: true, name: true } },
          shipmentType: { select: { name: true } },
        },
      }),
    ]);

    return ok({ orders, total, page, pageSize, pageCount: Math.ceil(total / pageSize) || 1 });
  });
}

// POST /api/orders — إنشاء طلب جديد (إدارة فقط)
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const body = await req.json();
    requireFields(body, [
      ["customerName", "اسم العميل"],
      ["phone", "رقم هاتف العميل"],
      ["governorate", "المحافظة"],
      ["city", "المدينة/المنطقة"],
      ["addressDetail", "العنوان التفصيلي"],
      ["pickupPlace", "مكان استلام الشحنة"],
      ["shipmentTypeId", "نوع الشحنة"],
    ]);

    const phone = String(body.phone).trim();
    const settings = await db.settings.findUnique({ where: { id: 1 } });

    // ربط العميل الموجود أو إنشاء عميل جديد (منع التكرار برقم الهاتف)
    let customer = await db.customer.findUnique({ where: { phone } });
    if (customer) {
      const updatedData: Record<string, string> = {};
      if (str(body.customerName) && customer.name !== String(body.customerName).trim())
        updatedData.name = String(body.customerName).trim();
      if (updatedData.name) await db.customer.update({ where: { id: customer.id }, data: updatedData });
    } else {
      customer = await db.customer.create({
        data: {
          name: String(body.customerName).trim(),
          phone,
          altPhone: str(body.altPhone),
          governorate: str(body.governorate),
          city: str(body.city),
          address: str(body.addressDetail),
        },
      });
    }

    const shipmentTypeId = num(body.shipmentTypeId, 0);
    const shipmentType = await db.shipmentType.findUnique({ where: { id: shipmentTypeId } });
    if (!shipmentType) throw new ApiError(400, "نوع الشحنة غير صحيح");

    const repId = num(body.repId, 0) || null;
    let assignedRep: { defaultCommission: number } | null = null;
    if (repId) {
      const rep = await db.representative.findUnique({ where: { id: repId } });
      if (!rep || !rep.active) throw new ApiError(400, "المندوب المحدد غير موجود أو موقوف");
      assignedRep = rep;
    }

    const deliveryFee = round2(num(body.deliveryFee));
    const shipmentCost = round2(num(body.shipmentCost));
    const additionalExpenses = round2(num(body.additionalExpenses));
    const hasExplicitCommission = body.repCommission !== undefined && body.repCommission !== null && body.repCommission !== "";
    const repCommission = hasExplicitCommission
      ? round2(num(body.repCommission))
      : repId
        ? resolveRepCommission(assignedRep, settings)
        : 0;
    const fin = computeFinancials({ deliveryFee, shipmentCost, additionalExpenses, repCommission });
    const requireOtp = settings?.requireOtp ?? true;
    const expected = str(body.expectedDeliveryAt) ? new Date(String(body.expectedDeliveryAt)) : null;
    if (expected && Number.isNaN(expected.getTime())) throw new ApiError(400, "موعد التسليم غير صحيح");

    const order = await db.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: tempOrderNumber(),
          customerId: customer!.id,
          receiverName: str(body.receiverName),
          phone,
          altPhone: str(body.altPhone),
          governorate: String(body.governorate),
          city: String(body.city),
          addressDetail: String(body.addressDetail),
          mapLink: str(body.mapLink),
          pickupPlace: String(body.pickupPlace),
          deliveryPlace: str(body.deliveryPlace) ?? String(body.city),
          shipmentTypeId,
          shipmentDesc: str(body.shipmentDesc),
          shipmentSize: str(body.shipmentSize),
          collectionAmount: round2(num(body.collectionAmount)),
          deliveryFee,
          shipmentCost,
          additionalExpenses,
          repCommission,
          nqelRevenue: fin.nqelRevenue,
          netProfit: fin.netProfit,
          notes: str(body.notes),
          status: repId ? "ASSIGNED" : "NEW",
          repId,
          assignedAt: repId ? new Date() : null,
          expectedDeliveryAt: expected,
          otpCode: requireOtp ? generateOtp() : null,
          createdById: admin.id,
          createdByName: admin.name,
          lastUpdatedById: admin.id,
          lastUpdatedByName: admin.name,
        },
      });
      const orderNumber = orderNumberFromId(created.id);
      const final = await tx.order.update({
        where: { id: created.id },
        data: { orderNumber },
      });
      await tx.statusHistory.create({
        data: {
          orderId: created.id,
          status: repId ? "ASSIGNED" : "NEW",
          note: repId ? "أُنشئ الطلب وأُسند مباشرة" : "أُنشئ الطلب",
          actorType: "ADMIN",
          actorId: admin.id,
          actorName: admin.name,
        },
      });
      return final;
    });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "CREATE",
      entityType: "ORDER",
      entityId: order.id,
      entityLabel: order.orderNumber,
      details: { بعد_الإنشاء: { ...order, otpCode: undefined } },
    });

    if (repId) {
      await notify({
        targetType: "REP",
        repId,
        type: "ASSIGN",
        title: "طلب جديد مُسند إليك",
        body: `الطلب ${order.orderNumber} — ${order.governorate} / ${order.city}`,
        orderId: order.id,
      });
    }

    return ok({ order }, 201);
  });
}
