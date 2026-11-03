import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity, num, pageParams, requireFields, round2, str, dayEnd, dayStart, validDate } from "@/lib/services";

// GET /api/expenses — المصروفات التشغيلية
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const { skip, take, page, pageSize } = pageParams(sp, 20);
    const from = str(sp.get("from"));
    const to = str(sp.get("to"));
    const category = str(sp.get("category"));

    const where: Record<string, unknown> = {};
    if (from || to) {
      where.expenseDate = {};
      if (from) (where.expenseDate as Record<string, Date>).gte = dayStart(from);
      if (to) {
        const end = dayEnd(to);
        (where.expenseDate as Record<string, Date>).lte = end;
      }
    }
    if (category) where.category = category;

    const [total, expenses, agg] = await Promise.all([
      db.expense.count({ where }),
      db.expense.findMany({ where, orderBy: { expenseDate: "desc" }, skip, take }),
      db.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    return ok({ expenses, total, page, pageSize, pageCount: Math.ceil(total / pageSize) || 1, totalAmount: round2(agg._sum.amount ?? 0) });
  });
}

// POST /api/expenses — تسجيل مصروف تشغيلي
export async function POST(req: NextRequest) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const body = await req.json();
    requireFields(body, [
      ["title", "بيان المصروف"],
      ["amount", "المبلغ"],
    ]);
    const amount = num(body.amount);
    if (amount <= 0) throw new ApiError(400, "المبلغ يجب أن يكون أكبر من صفر");
    const expenseDate = str(body.expenseDate) ? validDate(body.expenseDate, "تاريخ المصروف") : new Date();

    const expense = await db.expense.create({
      data: {
        title: String(body.title).trim(),
        category: str(body.category) ?? "عام",
        amount: round2(amount),
        expenseDate,
        notes: str(body.notes),
        createdById: admin.id,
        createdByName: admin.name,
      },
    });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "CREATE",
      entityType: "EXPENSE",
      entityId: expense.id,
      entityLabel: expense.title,
      details: { المبلغ: expense.amount, التصنيف: expense.category },
    });
    return ok({ expense }, 201);
  });
}
