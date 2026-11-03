import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { OTP_TTL_MS, generateOtp, logActivity } from "@/lib/services";

// POST /api/orders/[id]/otp — إعادة توليد رمز تأكيد التسليم (إدارة)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const orderId = Number(id);
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "الطلب غير موجود");
    if (order.status === "DELIVERED") throw new ApiError(400, "الطلب مُسلّم بالفعل");

    const otpCode = generateOtp();
    await db.order.update({
      where: { id: orderId },
      data: {
        otpCode,
        otpAttempts: 0,
        // الصلاحية تبدأ عند الخروج للتسليم؛ إن كان الطلب في الطريق بالفعل تبدأ الآن
        otpExpiresAt: order.status === "ON_WAY_DELIVERY" ? new Date(Date.now() + OTP_TTL_MS) : null,
      },
    });
    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "REGENERATE_OTP",
      entityType: "ORDER",
      entityId: orderId,
      entityLabel: order.orderNumber,
    });
    return ok({ otpCode });
  });
}
