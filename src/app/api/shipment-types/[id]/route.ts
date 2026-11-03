import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity } from "@/lib/services";

// PATCH /api/shipment-types/[id] — تفعيل/إيقاف
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const type = await db.shipmentType.update({
      where: { id: Number(id) },
      data: { active: Boolean(body.active) },
    });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "UPDATE",
      entityType: "SHIPMENT_TYPE",
      entityId: type.id,
      entityLabel: type.name,
      details: { الحالة: type.active ? "مفعّل" : "موقوف" },
    });
    return ok({ type });
  });
}

// DELETE /api/shipment-types/[id] — حذف فقط إن لم يكن مستخدمًا
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const typeId = Number(id);
    const used = await db.order.findFirst({ where: { shipmentTypeId: typeId } });
    if (used) {
      const type = await db.shipmentType.update({ where: { id: typeId }, data: { active: false } });
      await logActivity({
        actorType: "ADMIN",
        actorId: admin.id,
        actorName: admin.name,
        action: "UPDATE",
        entityType: "SHIPMENT_TYPE",
        entityId: typeId,
        entityLabel: type.name,
        details: { النتيجة: "مستخدم في طلبات — تم الإيقاف بدل الحذف" },
      });
      return ok({ success: true, deactivated: true });
    }
    const type = await db.shipmentType.delete({ where: { id: typeId } });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "DELETE",
      entityType: "SHIPMENT_TYPE",
      entityId: typeId,
      entityLabel: type.name,
    });
    return ok({ success: true, deleted: true });
  });
}
