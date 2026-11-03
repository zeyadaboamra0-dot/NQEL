import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireRep, wrap } from "@/lib/api";
import { logActivity, str } from "@/lib/services";

// GET /api/rep/profile
export async function GET() {
  return wrap(async () => {
    const rep = await requireRep();
    const { pinHash, ...safe } = rep;
    return ok({ rep: safe });
  });
}

// PATCH /api/rep/profile — تحديث رقم الهاتف والبيانات الشخصية فقط
export async function PATCH(req: NextRequest) {
  return wrap(async () => {
    const rep = await requireRep();
    const body = await req.json();
    const updated = await db.representative.update({
      where: { id: rep.id },
      data: {
        phone: "phone" in body ? str(body.phone) : undefined,
      },
    });
    await logActivity({
      actorType: "REP",
      actorId: rep.id,
      actorName: rep.name,
      action: "UPDATE",
      entityType: "REP",
      entityId: rep.id,
      entityLabel: rep.name,
      details: { الهاتف: updated.phone },
    });
    const { pinHash, ...safe } = updated;
    return ok({ rep: safe });
  });
}
