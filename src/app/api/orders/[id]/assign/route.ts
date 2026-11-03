import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { computeFinancials, logActivity, notify, num, resolveRepCommission, round2 } from "@/lib/services";

// POST /api/orders/[id]/assign — إسناد أو إعادة إسناد الطلب لمندوب (إدارة)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const orderId = Number(id);
    const body = await req.json();
    const repId = num(body.repId, 0);
    if (!repId) throw new ApiError(400, "اختر المندوب المسؤول");

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "الطلب غير موجود");
    if (["DELIVERED", "CANCELLED"].includes(order.status)) {
      throw new ApiError(400, "لا يمكن إسناد طلب مُسلّم أو ملغى");
    }

    const rep = await db.representative.findUnique({ where: { id: repId } });
    if (!rep || !rep.active) throw new ApiError(400, "المندوب غير موجود أو الحساب موقوف");
    // الطلبات المتوقفة (مؤجل / لا رد / رفض / تعذر) يجوز إعادة إسنادها لنفس المندوب لبدء محاولة جديدة
    const RETRYABLE = ["POSTPONED", "NO_ANSWER", "REFUSED", "FAILED"];
    if (order.repId === repId && !RETRYABLE.includes(order.status)) {
      throw new ApiError(400, "الطلب مُسند لهذا المندوب بالفعل");
    }

    const isReassign = order.repId !== null;

    // تطبيق عمولة المندوب إن كان الطلب بدون عمولة محددة (أو عمولة صريحة من الطلب)
    const explicitCommission = body.commission !== undefined && body.commission !== null && body.commission !== "";
    let repCommission = order.repCommission;
    if (explicitCommission) {
      repCommission = round2(num(body.commission));
    } else if (!isReassign && order.repCommission === 0) {
      const settings = await db.settings.findUnique({ where: { id: 1 } });
      repCommission = resolveRepCommission(rep, settings);
    }
    const fin = computeFinancials({
      deliveryFee: order.deliveryFee,
      shipmentCost: order.shipmentCost,
      additionalExpenses: order.additionalExpenses,
      repCommission,
    });

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        repId,
        repCommission,
        nqelRevenue: fin.nqelRevenue,
        netProfit: fin.netProfit,
        // المندوب الجديد يبدأ دورة قبول جديدة (فتُسجل محاولة جديدة في السجل)
        status: "ASSIGNED",
        assignedAt: new Date(),
        closedAt: null,
      },
    });

    await db.statusHistory.create({
      data: {
        orderId,
        status: updated.status,
        note: isReassign
          ? `إعادة إسناد من ${order.repId ? "مندوب آخر" : "غير مُسند"} إلى ${rep.name}`
          : `إسناد الطلب إلى ${rep.name}`,
        actorType: "ADMIN",
        actorId: admin.id,
        actorName: admin.name,
      },
    });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: isReassign ? "REASSIGN" : "ASSIGN",
      entityType: "ORDER",
      entityId: orderId,
      entityLabel: order.orderNumber,
      details: { المندوب_الجديد: rep.name, الحالة_السابقة: order.status },
    });

    await notify({
      targetType: "REP",
      repId,
      type: isReassign ? "REASSIGN" : "ASSIGN",
      title: isReassign ? "طلب مُعاد إسناده إليك" : "طلب جديد مُسند إليك",
      body: `الطلب ${order.orderNumber} — ${order.governorate} / ${order.city}`,
      orderId,
    });

    return ok({ order: updated });
  });
}
