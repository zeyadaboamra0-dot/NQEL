import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAdmin, wrap } from "@/lib/api";
import { round2 } from "@/lib/services";
import { FAILED_STATUSES, IN_PROGRESS_STATUSES, OPEN_STATUSES } from "@/lib/constants";

// GET /api/stats/dashboard — إحصائيات لوحة التحكم + بيانات الرسوم
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const days = Math.min(365, Math.max(1, Number(sp.get("days")) || 30));
    const repId = Number(sp.get("repId")) || undefined;

    const since = new Date(Date.now() - days * 86400000);
    since.setHours(0, 0, 0, 0);

    // نطاق موحّد لكل الأرقام: نفس الفترة ونفس المندوب
    const scope = { ...(repId ? { repId } : {}), createdAt: { gte: since } };

    const [allOrders, customers, settings, reps, expensesAgg] = await Promise.all([
      db.order.findMany({
        where: scope,
        select: {
          id: true, status: true, createdAt: true, expectedDeliveryAt: true, deliveredAt: true,
          nqelRevenue: true, netProfit: true, repCommission: true, shipmentCost: true,
          additionalExpenses: true, collectionAmount: true, collectionCollected: true, repId: true,
        },
      }),
      // العملاء الذين لهم طلبات داخل النطاق (العدّ الكلي لطلباتهم لتحديد المتكرر)
      db.customer.findMany({
        where: { orders: { some: scope } },
        select: { id: true, createdAt: true, _count: { select: { orders: true } } },
      }),
      db.settings.findUnique({ where: { id: 1 } }),
      db.representative.findMany({
        where: repId ? { id: repId } : {},
        select: {
          id: true, name: true, active: true,
          orders: {
            where: { createdAt: { gte: since } },
            select: { status: true, assignedAt: true, deliveredAt: true, expectedDeliveryAt: true },
          },
        },
      }),
      // المصروفات التشغيلية عامة للمنصة ولا تخص مندوبًا؛ تُستبعد عند اختيار مندوب بعينه
      repId
        ? Promise.resolve({ _sum: { amount: 0 } })
        : db.expense.aggregate({ where: { expenseDate: { gte: since } }, _sum: { amount: true } }),
    ]);
    const periodOrders = allOrders;

    const thresholdHours = settings?.lateThresholdHours ?? 0;
    const now = Date.now();

    // تصنيف الحالات
    const delivered = allOrders.filter((o) => o.status === "DELIVERED");
    const failed = allOrders.filter((o) => FAILED_STATUSES.includes(o.status));
    const inProgress = allOrders.filter((o) => IN_PROGRESS_STATUSES.includes(o.status));
    const postponed = allOrders.filter((o) => o.status === "POSTPONED");
    const cancelled = allOrders.filter((o) => o.status === "CANCELLED");
    const openOrders = allOrders.filter((o) => OPEN_STATUSES.includes(o.status));
    const late = openOrders.filter(
      (o) => o.expectedDeliveryAt && now > o.expectedDeliveryAt.getTime() + thresholdHours * 3600000
    );

    // المالية (الإيرادات تُحتسب على الطلبات المُسلّمة فقط لمنع التضخيم)
    const revenue = round2(delivered.reduce((s, o) => s + o.nqelRevenue, 0));
    const orderExpenses = round2(
      delivered.reduce((s, o) => s + o.repCommission + o.shipmentCost + o.additionalExpenses, 0)
    );
    const operationalExpenses = round2(expensesAgg._sum.amount ?? 0);
    const totalExpenses = round2(orderExpenses + operationalExpenses);
    const netProfit = round2(revenue - totalExpenses);
    const collectedTotal = round2(
      allOrders.filter((o) => o.collectionCollected).reduce((s, o) => s + o.collectionAmount, 0)
    );
    const dueTotal = round2(
      delivered.filter((o) => !o.collectionCollected).reduce((s, o) => s + o.collectionAmount, 0)
    );

    // العملاء
    const repeatCustomers = customers.filter((c) => c._count.orders > 1).length;
    const newCustomers = customers.length - repeatCustomers;
    const periodCustomers = customers.filter((c) => c.createdAt >= since).length;

    // سلاسل زمنية حسب اليوم
    const series: { date: string; orders: number; delivered: number; revenue: number; profit: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const next = new Date(day.getTime() + 86400000);
      const inDay = periodOrders.filter((o) => o.createdAt >= day && o.createdAt < next);
      const inDayDelivered = inDay.filter((o) => o.status === "DELIVERED");
      series.push({
        date: `${day.getMonth() + 1}/${day.getDate()}`,
        orders: inDay.length,
        delivered: inDayDelivered.length,
        revenue: round2(inDayDelivered.reduce((s, o) => s + o.nqelRevenue, 0)),
        profit: round2(inDayDelivered.reduce((s, o) => s + o.netProfit, 0)),
      });
    }

    // أداء المناديب
    const repPerformance = reps
      .map((r) => {
        const rDelivered = r.orders.filter((o) => o.status === "DELIVERED");
        const rFailed = r.orders.filter((o) => FAILED_STATUSES.includes(o.status));
        const onTime = rDelivered.filter(
          (o) => o.expectedDeliveryAt && o.deliveredAt && o.deliveredAt <= o.expectedDeliveryAt
        ).length;
        return {
          id: r.id,
          name: r.name,
          active: r.active,
          assigned: r.orders.length,
          delivered: rDelivered.length,
          failed: rFailed.length,
          successRate: r.orders.length ? Math.round((rDelivered.length / r.orders.length) * 100) : 0,
          onTimeRate: rDelivered.length ? Math.round((onTime / rDelivered.length) * 100) : 0,
        };
      })
      .sort((a, b) => b.delivered - a.delivered);

    const deliverySuccessRate = allOrders.length
      ? Math.round((delivered.length / allOrders.length) * 100)
      : 0;

    return ok({
      cards: {
        totalOrders: allOrders.length,
        newOrders: allOrders.filter((o) => o.status === "NEW").length,
        inProgressOrders: inProgress.length,
        deliveredOrders: delivered.length,
        lateOrders: late.length,
        failedOrders: failed.length,
        postponedOrders: postponed.length,
        cancelledOrders: cancelled.length,
        totalCustomers: customers.length,
        newCustomers: periodCustomers,
        repeatCustomers,
        revenue,
        orderExpenses,
        operationalExpenses,
        totalExpenses,
        netProfit,
        collectedTotal,
        dueTotal,
        deliverySuccessRate,
      },
      series,
      repPerformance,
      statusSplit: {
        delivered: delivered.length,
        failed: failed.length,
        inProgress: inProgress.length,
        postponed: postponed.length,
        cancelled: cancelled.length,
        new: allOrders.filter((o) => o.status === "NEW").length,
      },
      customersSplit: { new: newCustomers, repeat: repeatCustomers },
      days,
      scope: {
        days,
        repId: repId ?? null,
        operationalExpensesIncluded: !repId,
        note: "كل الأرقام محسوبة على نفس الفترة والمندوب المختارين؛ المصروفات التشغيلية العامة لا تدخل عند اختيار مندوب.",
      },
    });
  });
}
