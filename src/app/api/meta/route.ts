import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession, ok, wrap } from "@/lib/api";

// GET /api/meta — بيانات مساعدة للواجهة حسب الجلسة
export async function GET(req: NextRequest) {
  return wrap(async () => {
    const session = await getSession();
    if (!session) return ok({ authenticated: false });
    const settings = (await db.settings.findUnique({ where: { id: 1 } })) ?? null;

    if (session.role === "ADMIN") {
      const [reps, shipmentTypes] = await Promise.all([
        db.representative.findMany({
          where: { active: true },
          select: { id: true, name: true, code: true, defaultCommission: true },
          orderBy: { name: "asc" },
        }),
        db.shipmentType.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
      ]);
      return ok({ authenticated: true, role: "ADMIN", reps, shipmentTypes, settings });
    }

    // للمندوب: بيانات محدودة تخصه فقط
    const rep = await db.representative.findUnique({
      where: { id: Number(session.sub) },
      select: { id: true, name: true, code: true, phone: true, governorate: true, city: true, vehicleType: true },
    });
    return ok({ authenticated: true, role: "REP", settings, rep });
  });
}
