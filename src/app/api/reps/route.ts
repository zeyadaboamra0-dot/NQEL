import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, hashSecret, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity, num, requireFields, str } from "@/lib/services";

// GET /api/reps — قائمة المناديب مع ملخص الأداء
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const q = str(sp.get("q"));
    const active = sp.get("active");

    const where: Record<string, unknown> = {};
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { phone: { contains: q, mode: "insensitive" } }];
    if (active === "1") where.active = true;
    if (active === "0") where.active = false;

    const reps = await db.representative.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { orders: true } },
        orders: { select: { status: true, deliveredAt: true, expectedDeliveryAt: true } },
      },
    });

    const list = reps.map((r) => {
      const delivered = r.orders.filter((o) => o.status === "DELIVERED");
      const onTime = delivered.filter(
        (o) => o.expectedDeliveryAt && o.deliveredAt && o.deliveredAt <= o.expectedDeliveryAt
      ).length;
      const successRate = r.orders.length
        ? Math.round((delivered.length / r.orders.length) * 100)
        : 0;
      return {
        id: r.id,
        code: r.code,
        name: r.name,
        phone: r.phone,
        governorate: r.governorate,
        city: r.city,
        vehicleType: r.vehicleType,
        active: r.active,
        defaultCommission: r.defaultCommission,
        notes: r.notes,
        createdAt: r.createdAt,
        totalOrders: r._count.orders,
        deliveredCount: delivered.length,
        successRate,
        onTimeRate: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
      };
    });
    return ok({ reps: list });
  });
}

// POST /api/reps — إنشاء حساب مندوب بكود دخول وPIN
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const body = await req.json();
    requireFields(body, [
      ["name", "اسم المندوب"],
      ["pin", "رمز PIN"],
    ]);
    const pin = String(body.pin).trim();
    if (pin.length < 6) throw new ApiError(400, "رمز PIN يجب أن يكون 6 خانات على الأقل");

    let code = String(body.code || "").trim().toUpperCase();
    if (!code) {
      // توليد كود فريد
      for (let i = 0; i < 30; i++) {
        const candidate = `NQ${Math.floor(1000 + Math.random() * 9000)}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}`;
        const exists = await db.representative.findUnique({ where: { code: candidate } });
        if (!exists) {
          code = candidate;
          break;
        }
      }
    }
    if (!code) throw new ApiError(500, "تعذر توليد كود دخول فريد — أعد المحاولة");
    const codeTaken = await db.representative.findUnique({ where: { code } });
    if (codeTaken) throw new ApiError(400, "كود الدخول مستخدم بالفعل — اختر كودًا آخر");

    const rep = await db.representative.create({
      data: {
        code,
        name: String(body.name).trim(),
        pinHash: await hashSecret(pin),
        phone: str(body.phone),
        governorate: str(body.governorate),
        city: str(body.city),
        vehicleType: str(body.vehicleType),
        defaultCommission: num(body.defaultCommission, 0),
        notes: str(body.notes),
      },
    });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "CREATE",
      entityType: "REP",
      entityId: rep.id,
      entityLabel: rep.name,
      details: { الكود: rep.code, الاسم: rep.name },
    });

    return ok({ rep: { id: rep.id, code: rep.code, name: rep.name } }, 201);
  });
}
