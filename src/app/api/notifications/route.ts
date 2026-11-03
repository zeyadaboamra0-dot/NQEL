import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, getSession, ok, wrap } from "@/lib/api";
import { num, pageParams, str } from "@/lib/services";

// GET /api/notifications — إشعارات حسب الجلسة (إدارة/مندوب)
export async function GET(req: NextRequest) {
  return wrap(async () => {
    const session = await getSession();
    if (!session) throw new ApiError(401, "غير مصرح");
    const sp = req.nextUrl.searchParams;
    const { skip, take, page, pageSize } = pageParams(sp, 20);

    const where =
      session.role === "ADMIN"
        ? { targetType: "ADMIN" }
        : { targetType: "REP", repId: Number(session.sub) };
    const unreadOnly = sp.get("unread") === "1";
    const whereFinal = unreadOnly ? { ...where, read: false } : where;

    const [total, notifications, unread] = await Promise.all([
      db.notification.count({ where: whereFinal }),
      db.notification.findMany({
        where: whereFinal,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: { order: { select: { orderNumber: true } } },
      }),
      db.notification.count({ where: { ...where, read: false } }),
    ]);

    return ok({ notifications, total, unread, page, pageSize, pageCount: Math.ceil(total / pageSize) || 1 });
  });
}

// PATCH /api/notifications — تعليم كمقروءة
export async function PATCH(req: NextRequest) {
  return wrap(async () => {
    const session = await getSession();
    if (!session) throw new ApiError(401, "غير مصرح");
    const body = await req.json().catch(() => ({}));
    const where =
      session.role === "ADMIN"
        ? { targetType: "ADMIN" }
        : { targetType: "REP", repId: Number(session.sub) };
    if (body.all) {
      await db.notification.updateMany({ where, data: { read: true } });
    } else if (body.id) {
      const id = num(body.id);
      await db.notification.updateMany({ where: { ...where, id }, data: { read: true } });
    } else if (Array.isArray(body.ids)) {
      await db.notification.updateMany({ where: { ...where, id: { in: body.ids.map(Number) } }, data: { read: true } });
    }
    const unread = await db.notification.count({ where: { ...where, read: false } });
    return ok({ success: true, unread });
  });
}
