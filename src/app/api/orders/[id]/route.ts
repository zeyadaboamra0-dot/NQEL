import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import {
  computeFinancials,
  diffFields,
  logActivity,
  notify,
  num,
  round2,
  str,
} from "@/lib/services";

// GET /api/orders/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    await requireAdmin();
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id: Number(id) },
      include: {
        customer: true,
        rep: { select: { id: true, name: true, phone: true } },
        shipmentType: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw new ApiError(404, "الطلب غير موجود");
    return ok({ order });
  });
}

// PATCH /api/orders/[id] — تعديل بيانات الطلب (إدارة فقط)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const orderId = Number(id);
    const existing = await db.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new ApiError(404, "الطلب غير موجود");

    const body = await req.json();
    for (const [k, label] of [["phone", "رقم الهاتف"], ["governorate", "المحافظة"], ["city", "المدينة"], ["addressDetail", "العنوان التفصيلي"], ["pickupPlace", "مكان الاستلام"]] as const) {
      if (k in body && !str(body[k])) throw new ApiError(400, `${label} مطلوب ولا يمكن تركه فارغًا`);
    }
    if ("expectedDeliveryAt" in body && str(body.expectedDeliveryAt) && Number.isNaN(new Date(String(body.expectedDeliveryAt)).getTime())) {
      throw new ApiError(400, "موعد التسليم غير صحيح");
    }
    const TRACKED = [
      "receiverName", "phone", "altPhone", "governorate", "city", "addressDetail",
      "mapLink", "pickupPlace", "deliveryPlace", "shipmentDesc", "shipmentSize",
      "collectionAmount", "deliveryFee", "shipmentCost", "additionalExpenses",
      "repCommission", "notes",
    ];
    const changes = diffFields(existing as unknown as Record<string, unknown>, body, TRACKED);

    const deliveryFee = "deliveryFee" in body ? round2(num(body.deliveryFee)) : existing.deliveryFee;
    const shipmentCost = "shipmentCost" in body ? round2(num(body.shipmentCost)) : existing.shipmentCost;
    const additionalExpenses = "additionalExpenses" in body ? round2(num(body.additionalExpenses)) : existing.additionalExpenses;
    const repCommission = "repCommission" in body ? round2(num(body.repCommission)) : existing.repCommission;
    const fin = computeFinancials({ deliveryFee, shipmentCost, additionalExpenses, repCommission });

    const expected = "expectedDeliveryAt" in body
      ? (str(body.expectedDeliveryAt) ? new Date(String(body.expectedDeliveryAt)) : null)
      : existing.expectedDeliveryAt;

    const order = await db.order.update({
      where: { id: orderId },
      data: {
        receiverName: "receiverName" in body ? str(body.receiverName) : undefined,
        phone: "phone" in body ? String(body.phone).trim() : undefined,
        altPhone: "altPhone" in body ? str(body.altPhone) : undefined,
        governorate: "governorate" in body ? String(body.governorate) : undefined,
        city: "city" in body ? String(body.city) : undefined,
        addressDetail: "addressDetail" in body ? String(body.addressDetail) : undefined,
        mapLink: "mapLink" in body ? str(body.mapLink) : undefined,
        pickupPlace: "pickupPlace" in body ? String(body.pickupPlace) : undefined,
        deliveryPlace: "deliveryPlace" in body ? str(body.deliveryPlace) : undefined,
        shipmentDesc: "shipmentDesc" in body ? str(body.shipmentDesc) : undefined,
        shipmentSize: "shipmentSize" in body ? str(body.shipmentSize) : undefined,
        collectionAmount: "collectionAmount" in body ? round2(num(body.collectionAmount)) : undefined,
        deliveryFee,
        shipmentCost,
        additionalExpenses,
        repCommission,
        nqelRevenue: fin.nqelRevenue,
        netProfit: fin.netProfit,
        notes: "notes" in body ? str(body.notes) : undefined,
        expectedDeliveryAt: "expectedDeliveryAt" in body ? expected : undefined,
        lastUpdatedById: admin.id,
        lastUpdatedByName: admin.name,
      },
    });

    // تحديث بيانات العميل الأساسية إن تغيّرت
    if (body.customerName && String(body.customerName).trim() !== "") {
      await db.customer.update({
        where: { id: existing.customerId },
        data: { name: String(body.customerName).trim() },
      });
    }

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "UPDATE",
      entityType: "ORDER",
      entityId: orderId,
      entityLabel: existing.orderNumber,
      details: { تغييرات: changes },
    });

    // إشعار المندوب المسند إليه بتغيير البيانات
    if (order.repId && Object.keys(changes).length > 0) {
      await notify({
        targetType: "REP",
        repId: order.repId,
        type: "ORDER_UPDATED",
        title: "تم تحديث بيانات الطلب",
        body: `الطلب ${order.orderNumber} — عدّل الإدارة بيانات الطلب`,
        orderId: order.id,
      });
    }

    return ok({ order, changes });
  });
}

// DELETE /api/orders/[id] — حذف الطلب (إدارة فقط، مسجل في السجل)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const orderId = Number(id);
    const existing = await db.order.findUnique({ where: { id: orderId } });
    if (!existing) throw new ApiError(404, "الطلب غير موجود");

    await db.order.delete({ where: { id: orderId } });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "DELETE",
      entityType: "ORDER",
      entityId: orderId,
      entityLabel: existing.orderNumber,
      details: { البيانات_المحذوفة: { ...existing, otpCode: undefined } },
    });
    return ok({ success: true });
  });
}
