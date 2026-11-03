import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireRep, wrap } from "@/lib/api";

// GET /api/rep/orders/[id] — تفاصيل الطلب للمندوب المسند إليه فقط
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const rep = await requireRep();
    const { id } = await params;
    const order = await db.order.findUnique({
      where: { id: Number(id) },
      include: {
        customer: { select: { name: true, phone: true, altPhone: true } },
        shipmentType: { select: { name: true } },
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!order) throw new ApiError(404, "الطلب غير موجود");
    if (order.repId !== rep.id) throw new ApiError(403, "هذا الطلب غير مُسند إليك");

    // لا نكشف OTP للمندوب مباشرة — يُدخله العميل؛ لكن نُظهر هل مطلوب أم لا
    const { otpCode, ...safe } = order;
    return ok({ order: { ...safe, hasOtp: Boolean(otpCode) } });
  });
}
