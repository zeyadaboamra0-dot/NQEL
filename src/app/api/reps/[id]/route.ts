import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, hashSecret, ok, requireAdmin, wrap } from "@/lib/api";
import { diffFields, logActivity, notify, num, round2, str, dayEnd, dayStart } from "@/lib/services";
import { FAILED_STATUSES, IN_PROGRESS_STATUSES } from "@/lib/constants";

// GET /api/reps/[id] — ملف المندوب + مؤشرات الأداء + آخر الطلبات + المستحقات
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    await requireAdmin();
    const { id } = await params;
    const repId = Number(id);
    const rep = await db.representative.findUnique({ where: { id: repId } });
    if (!rep) throw new ApiError(404, "المندوب غير موجود");

    const sp = req.nextUrl.searchParams;
    const from = str(sp.get("from"));
    const to = str(sp.get("to"));
    const range: { gte?: Date; lte?: Date } = {};
    if (from) range.gte = dayStart(from);
    if (to) {
      const end = dayEnd(to);
      range.lte = end;
    }

    const orders = await db.order.findMany({
      where: { repId, createdAt: range },
      orderBy: { createdAt: "desc" },
      include: { customer: { select: { name: true, phone: true } }, shipmentType: { select: { name: true } } },
    });

    const delivered = orders.filter((o) => o.status === "DELIVERED");
    const failed = orders.filter((o) => FAILED_STATUSES.includes(o.status));
    const inProgress = orders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status));
    const lateDelivered = delivered.filter(
      (o) => o.expectedDeliveryAt && o.deliveredAt && o.deliveredAt > o.expectedDeliveryAt
    );
    const currentlyLate = inProgress.filter(
      (o) => o.expectedDeliveryAt && o.expectedDeliveryAt < new Date()
    );
    const durations = delivered
      .filter((o) => o.assignedAt && o.deliveredAt)
      .map((o) => o.deliveredAt!.getTime() - o.assignedAt!.getTime());
    const avgDeliveryMs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const onTime = delivered.length - lateDelivered.length;

    const totalCommission = round2(
      delivered.reduce((s, o) => s + o.repCommission, 0)
    );
    const payouts = await db.payout.findMany({ where: { repId, ...(from || to ? { payoutDate: range } : {}) } });
    const totalPaid = round2(payouts.reduce((s, p) => s + p.amount, 0));

    return ok({
      rep: { ...rep, pinHash: undefined },
      performance: {
        assigned: orders.length,
        delivered: delivered.length,
        failed: failed.length,
        inProgress: inProgress.length,
        late: lateDelivered.length + currentlyLate.length,
        successRate: orders.length ? Math.round((delivered.length / orders.length) * 100) : 0,
        onTimeRate: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
        avgDeliveryMs,
        attempts: orders.reduce((s, o) => s + o.attempts, 0),
      },
      dues: { totalCommission, totalPaid, remaining: round2(totalCommission - totalPaid) },
      payouts,
      orders,
    });
  });
}

// PATCH /api/reps/[id] — تعديل بيانات المندوب / تفعيل-إيقاف / تصفير PIN
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const repId = Number(id);
    const rep = await db.representative.findUnique({ where: { id: repId } });
    if (!rep) throw new ApiError(404, "المندوب غير موجود");

    const body = await req.json();
    const TRACKED = ["name", "phone", "governorate", "city", "vehicleType", "defaultCommission", "notes", "active", "code"];
    const changes = diffFields(rep as unknown as Record<string, unknown>, body, TRACKED);

    if ("name" in body && !str(body.name)) throw new ApiError(400, "اسم المندوب مطلوب");
    if ("code" in body && !str(body.code)) throw new ApiError(400, "كود الدخول مطلوب");
    if (body.code !== undefined) {
      const newCode = String(body.code).trim().toUpperCase();
      if (newCode !== rep.code) {
        const taken = await db.representative.findUnique({ where: { code: newCode } });
        if (taken) throw new ApiError(400, "كود الدخول مستخدم بالفعل");
      }
    }

    const data: Record<string, unknown> = {};
    if ("name" in body) data.name = String(body.name).trim();
    if ("phone" in body) data.phone = str(body.phone);
    if ("governorate" in body) data.governorate = str(body.governorate);
    if ("city" in body) data.city = str(body.city);
    if ("vehicleType" in body) data.vehicleType = str(body.vehicleType);
    if ("defaultCommission" in body) data.defaultCommission = num(body.defaultCommission);
    if ("notes" in body) data.notes = str(body.notes);
    if ("active" in body) data.active = Boolean(body.active);
    if ("code" in body) data.code = String(body.code).trim().toUpperCase();
    if (body.resetPin) {
      const pin = String(body.resetPin).trim();
      if (pin.length < 6) throw new ApiError(400, "رمز PIN الجديد يجب أن يكون 6 خانات على الأقل");
      data.pinHash = await hashSecret(pin);
      data.sessionVersion = { increment: 1 }; // إنهاء جلسات المندوب القديمة
    }

    const updated = await db.representative.update({ where: { id: repId }, data });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: body.resetPin ? "RESET_PIN" : "UPDATE",
      entityType: "REP",
      entityId: repId,
      entityLabel: rep.name,
      details: { تغييرات: changes, ...(body.resetPin ? { PIN: "تمت إعادة التعيين" } : {}) },
    });

    if ("active" in body && !body.active) {
      await notify({
        targetType: "REP",
        repId,
        type: "INFO",
        title: "تم إيقاف حسابك",
        body: "قامت الإدارة بإيقاف حسابك مؤقتًا",
      });
    }

    return ok({ rep: { ...updated, pinHash: undefined } });
  });
}

// DELETE /api/reps/[id] — حذف المندوب إن لم يكن له طلبات، وإلا إيقاف فقط
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const repId = Number(id);
    const rep = await db.representative.findUnique({
      where: { id: repId },
      include: { _count: { select: { orders: true, payouts: true } } },
    });
    if (!rep) throw new ApiError(404, "المندوب غير موجود");

    if (rep._count.orders > 0 || rep._count.payouts > 0) {
      await db.representative.update({ where: { id: repId }, data: { active: false } });
      await logActivity({
        actorType: "ADMIN",
        actorId: admin.id,
        actorName: admin.name,
        action: "DEACTIVATE",
        entityType: "REP",
        entityId: repId,
        entityLabel: rep.name,
        details: { السبب: "له طلبات أو دفعات مرتبطة — تم الإيقاف بدل الحذف" },
      });
      return ok({ success: true, deactivated: true });
    }

    await db.representative.delete({ where: { id: repId } });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "DELETE",
      entityType: "REP",
      entityId: repId,
      entityLabel: rep.name,
    });
    return ok({ success: true, deleted: true });
  });
}
