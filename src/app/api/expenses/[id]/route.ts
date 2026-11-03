import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { logActivity } from "@/lib/services";

// DELETE /api/expenses/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const expense = await db.expense.findUnique({ where: { id: Number(id) } });
    if (!expense) throw new ApiError(404, "المصروف غير موجود");
    await db.expense.delete({ where: { id: expense.id } });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "DELETE",
      entityType: "EXPENSE",
      entityId: expense.id,
      entityLabel: expense.title,
      details: { المبلغ: expense.amount },
    });
    return ok({ success: true });
  });
}
