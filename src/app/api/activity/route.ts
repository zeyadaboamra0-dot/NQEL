import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, requireAdmin, wrap } from "@/lib/api";
import { pageParams, str } from "@/lib/services";
import type { Prisma } from "@prisma/client";

// GET /api/activity — سجل العمليات (إدارة فقط، للقراءة فقط)
export async function GET(req: NextRequest) {
  return wrap(async () => {
    await requireAdmin();
    const sp = req.nextUrl.searchParams;
    const { skip, take, page, pageSize } = pageParams(sp, 25);
    const q = str(sp.get("q"));
    const entityType = str(sp.get("entityType"));
    const action = str(sp.get("action"));

    const where: Prisma.ActivityLogWhereInput = {};
    if (entityType) where.entityType = entityType;
    if (action) where.action = action;
    if (q) {
      where.OR = [
        { actorName: { contains: q, mode: "insensitive" } },
        { entityLabel: { contains: q, mode: "insensitive" } },
        { details: { contains: q, mode: "insensitive" } },
      ];
    }

    const [total, logs] = await Promise.all([
      db.activityLog.count({ where }),
      db.activityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    ]);

    return ok({ logs, total, page, pageSize, pageCount: Math.ceil(total / pageSize) || 1 });
  });
}
