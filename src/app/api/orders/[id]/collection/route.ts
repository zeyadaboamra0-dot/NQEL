import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity } from "@/lib/services";

// POST /api/orders/[id]/collection — تأكيد/إلغاء تحصيل قيمة الطلب من العميل (إدارة)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const orderId = Number(id);
    const body = await req.json();
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "الطلب غير موجود");

    const collected = Boolean(body.collected);
    const updated = await db.order.update({
      where: { id: orderId },
      data: { collectionCollected: collected },
    });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "UPDATE",
      entityType: "ORDER",
      entityId: orderId,
      entityLabel: order.orderNumber,
      details: { التحصيل: { old: order.collectionCollected ? "محصل" : "غير محصل", new: collected ? "محصل" : "غير محصل" } },
    });
    return ok({ order: updated });
  });
}
