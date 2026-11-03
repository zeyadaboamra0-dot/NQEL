import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity, num, pageParams, requireFields, round2, str, validDate } from "@/lib/services";

// GET /api/payouts?repId= — سجل دفعات المناديب + ملخص مستحقات كل مندوب
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const repId = num(sp.get("repId"), 0);
    const { skip, take, page, pageSize } = pageParams(sp, 20);

    const where: Record<string, unknown> = {};
    if (repId) where.repId = repId;

    const [total, payouts, reps] = await Promise.all([
      db.payout.count({ where }),
      db.payout.findMany({
        where,
        orderBy: { payoutDate: "desc" },
        skip,
        take,
        include: { rep: { select: { id: true, name: true, code: true } } },
      }),
      db.representative.findMany({
        where: repId ? { id: repId } : { active: true },
        include: {
          orders: { where: { status: "DELIVERED" }, select: { repCommission: true } },
          payouts: { select: { amount: true } },
        },
      }),
    ]);

    const dues = reps.map((r) => {
      const totalCommission = round2(r.orders.reduce((s, o) => s + o.repCommission, 0));
      const paid = round2(r.payouts.reduce((s, p) => s + p.amount, 0));
      return {
        repId: r.id,
        repName: r.name,
        repCode: r.code,
        totalCommission,
        paid,
        remaining: round2(totalCommission - paid),
      };
    });

    return ok({ payouts, total, page, pageSize, pageCount: Math.ceil(total / pageSize) || 1, dues });
  });
}

// POST /api/payouts — تسجيل دفعة لمندوب
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const body = await req.json();
    requireFields(body, [
      ["repId", "المندوب"],
      ["amount", "المبلغ"],
    ]);
    const amount = num(body.amount);
    if (amount <= 0) throw new ApiError(400, "المبلغ يجب أن يكون أكبر من صفر");
    const rep = await db.representative.findUnique({ where: { id: num(body.repId) } });
    if (!rep) throw new ApiError(404, "المندوب غير موجود");

    // لا تُقبل دفعة تتجاوز المستحق إلا إذا سُجّلت صراحةً كسلفة
    const isAdvance = body.advance === true;
    const [earnedAgg, paidAgg] = await Promise.all([
      db.order.aggregate({ where: { repId: rep.id, status: "DELIVERED" }, _sum: { repCommission: true } }),
      db.payout.aggregate({ where: { repId: rep.id }, _sum: { amount: true } }),
    ]);
    const remaining = round2((earnedAgg._sum.repCommission ?? 0) - (paidAgg._sum.amount ?? 0));
    if (!isAdvance && round2(amount) > remaining) {
      throw new ApiError(
        400,
        `المبلغ (${round2(amount)}) أكبر من المستحق المتبقي للمندوب (${Math.max(remaining, 0)}). لتسجيله كسلفة فعّل خيار «سلفة».`
      );
    }

    const payout = await db.payout.create({
      data: {
        repId: rep.id,
        amount: round2(amount),
        note: isAdvance ? `[سلفة] ${str(body.note) ?? ""}`.trim() : str(body.note),
        payoutDate: str(body.payoutDate) ? validDate(body.payoutDate, "تاريخ الدفعة") : new Date(),
        createdById: admin.id,
        createdByName: admin.name,
      },
    });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: isAdvance ? "ADVANCE" : "CREATE",
      entityType: "PAYOUT",
      entityId: payout.id,
      entityLabel: rep.name,
      details: { المبلغ: payout.amount, ...(isAdvance ? { سلفة: true, المتبقي_قبل_الدفع: remaining } : {}) },
    });
    return ok({ payout }, 201);
  });
}
