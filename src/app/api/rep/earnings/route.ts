import { db } from "@/lib/db";
import { ok, requireRep, wrap } from "@/lib/api";
import { round2 } from "@/lib/services";

// GET /api/rep/earnings — مستحقات المندوب: المكتسب، المدفوع، المتبقي + السجل
export async function GET() {
  return wrap(async () => {
    const rep = await requireRep();
    const [deliveredOrders, payouts] = await Promise.all([
      db.order.findMany({
        where: { repId: rep.id, status: "DELIVERED" },
        select: { id: true, orderNumber: true, repCommission: true, deliveredAt: true },
        orderBy: { deliveredAt: "desc" },
      }),
      db.payout.findMany({
        where: { repId: rep.id },
        orderBy: { payoutDate: "desc" },
      }),
    ]);
    const totalEarned = round2(deliveredOrders.reduce((s, o) => s + o.repCommission, 0));
    const totalPaid = round2(payouts.reduce((s, p) => s + p.amount, 0));
    return ok({
      totalEarned,
      totalPaid,
      remaining: round2(totalEarned - totalPaid),
      orders: deliveredOrders,
      payouts,
    });
  });
}
