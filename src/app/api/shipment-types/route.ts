import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity, str } from "@/lib/services";

// GET /api/shipment-types
export async function GET() {
  return wrap(async () => {
    await requireAdmin();
    const types = await db.shipmentType.findMany({ orderBy: { id: "asc" } });
    return ok({ types });
  });
}

// POST /api/shipment-types — إضافة نوع شحنة جديد
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const body = await req.json();
    const name = str(body.name);
    if (!name) throw new ApiError(400, "أدخل اسم نوع الشحنة");
    const exists = await db.shipmentType.findUnique({ where: { name } });
    if (exists) throw new ApiError(400, "هذا النوع موجود بالفعل");
    const type = await db.shipmentType.create({ data: { name } });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "CREATE",
      entityType: "SHIPMENT_TYPE",
      entityId: type.id,
      entityLabel: name,
    });
    return ok({ type }, 201);
  });
}
