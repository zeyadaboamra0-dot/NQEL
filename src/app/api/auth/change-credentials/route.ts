import { NextRequest } from "next/server";
import {
  ApiError,
  createSession,
  getSession,
  hashSecret,
  ok,
  requireAdmin,
  requireRep,
  verifySecret,
  wrap,
} from "@/lib/api";
import { db } from "@/lib/db";
import { logActivity } from "@/lib/services";

// تغيير PIN المندوب أو كلمة مرور الإدارة
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const body = await req.json().catch(() => ({}));
    const current = String(body.current || "");
    const next = String(body.next || "");

    const session = await getSession();
    if (!session) throw new ApiError(401, "غير مصرح");
    if (session.role === "REP" && next.length < 6) {
      throw new ApiError(400, "رمز PIN الجديد يجب أن يكون 6 خانات على الأقل");
    }
    if (session.role === "ADMIN" && next.length < 8) {
      throw new ApiError(400, "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
    }
    if (next === current) throw new ApiError(400, "الرمز الجديد يجب أن يختلف عن الحالي");

    if (session.role === "REP") {
      const rep = await requireRep();
      const valid = await verifySecret(current, rep.pinHash);
      if (!valid) throw new ApiError(400, "رمز PIN الحالي غير صحيح");
      // رفع إصدار الجلسة يُنهي كل الجلسات القديمة؛ ثم نُصدر جلسة جديدة لهذا الجهاز
      const updatedRep = await db.representative.update({
        where: { id: rep.id },
        data: { pinHash: await hashSecret(next), sessionVersion: { increment: 1 } },
      });
      await createSession({ sub: String(rep.id), role: "REP", name: rep.name, ver: updatedRep.sessionVersion });
      await logActivity({
        actorType: "REP",
        actorId: rep.id,
        actorName: rep.name,
        action: "CHANGE_PIN",
        entityType: "REP",
        entityId: rep.id,
        entityLabel: rep.name,
      });
      return ok({ success: true });
    }

    const admin = await requireAdmin();
    const valid = await verifySecret(current, admin.passwordHash);
    if (!valid) throw new ApiError(400, "كلمة المرور الحالية غير صحيحة");
    const updatedAdmin = await db.admin.update({
      where: { id: admin.id },
      data: { passwordHash: await hashSecret(next), sessionVersion: { increment: 1 } },
    });
    await createSession({ sub: String(admin.id), role: "ADMIN", name: admin.name, ver: updatedAdmin.sessionVersion });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "CHANGE_PASSWORD",
      entityType: "AUTH",
      entityId: admin.id,
      entityLabel: admin.email,
    });
    return ok({ success: true });
  });
}
