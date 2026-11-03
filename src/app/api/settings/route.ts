import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAdmin, wrap } from "@/lib/api";
import { diffFields, logActivity, num } from "@/lib/services";

// GET /api/settings — الإعدادات العامة (متاحة للجلسات المصرح بها)
export async function GET() {
  return wrap(async () => {
    await requireAdmin();
    let settings = await db.settings.findUnique({ where: { id: 1 } });
    if (!settings) settings = await db.settings.create({ data: { id: 1 } });
    return ok({ settings });
  });
}

// PATCH /api/settings — تحديث الإعدادات (إدارة)
export async function PATCH(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const existing = (await db.settings.findUnique({ where: { id: 1 } }))!;
    const body = await req.json();

    const changes = diffFields(existing as unknown as Record<string, unknown>, body, [
      "platformName", "currency", "requireOtp", "requireReceiverName", "requireProof",
      "lateThresholdHours", "defaultCommission",
    ]);

    const settings = await db.settings.update({
      where: { id: 1 },
      data: {
        platformName: body.platformName !== undefined ? String(body.platformName) : undefined,
        currency: body.currency !== undefined ? String(body.currency) : undefined,
        requireOtp: body.requireOtp !== undefined ? Boolean(body.requireOtp) : undefined,
        requireReceiverName: body.requireReceiverName !== undefined ? Boolean(body.requireReceiverName) : undefined,
        requireProof: body.requireProof !== undefined ? Boolean(body.requireProof) : undefined,
        lateThresholdHours: body.lateThresholdHours !== undefined ? num(body.lateThresholdHours) : undefined,
        defaultCommission: body.defaultCommission !== undefined ? num(body.defaultCommission) : undefined,
      },
    });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "UPDATE",
      entityType: "SETTINGS",
      entityId: 1,
      entityLabel: "إعدادات المنصة",
      details: { تغييرات: changes },
    });
    return ok({ settings });
  });
}
