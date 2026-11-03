import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, requireRep, wrap } from "@/lib/api";
import { OTP_MAX_ATTEMPTS, OTP_TTL_MS, logActivity, notify, notifyAdmins, str } from "@/lib/services";
import { ORDER_STATUS_LABELS, REP_FLOW } from "@/lib/constants";
import type { Order, OrderStatus } from "@prisma/client";

type Body = {
  status?: OrderStatus;
  reason?: string;
  otpCode?: string;
  receiverSigned?: string;
  deliveryProof?: string;
  collected?: boolean;
  note?: string;
};

const NEEDS_REASON: OrderStatus[] = ["FAILED", "POSTPONED", "NO_ANSWER", "REFUSED", "CANCELLED"];
const ATTEMPT_STATUSES: OrderStatus[] = ["FAILED", "NO_ANSWER", "REFUSED", "POSTPONED"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const body: Body = await req.json();
    const { id } = await params;
    const orderId = Number(id);
    const nextStatus = body.status;
    if (!nextStatus) throw new ApiError(400, "الحالة المطلوبة غير محددة");

    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order) throw new ApiError(404, "الطلب غير موجود");
    if (["DELIVERED", "CANCELLED"].includes(order.status)) {
      throw new ApiError(400, "هذا الطلب مُغلق ولا يمكن تغيير حالته");
    }

    // من يشغّل العملية: مندوب (تدفق عادي) أو إدارة (إلغاء فقط)
    let actorType: "ADMIN" | "REP";
    let actorId: number;
    let actorName: string;
    const sessionRep = await requireRep().catch(() => null);
    if (sessionRep) {
      actorType = "REP";
      actorId = sessionRep.id;
      actorName = sessionRep.name;
      if (order.repId !== sessionRep.id) {
        throw new ApiError(403, "هذا الطلب غير مُسند إليك");
      }
      const flow = REP_FLOW[order.status];
      if (!flow || !flow.next.includes(nextStatus)) {
        throw new ApiError(
          400,
          `لا يمكن الانتقال من «${ORDER_STATUS_LABELS[order.status]}» إلى «${ORDER_STATUS_LABELS[nextStatus]}»`
        );
      }
      if (NEEDS_REASON.includes(nextStatus) && !str(body.reason)) {
        throw new ApiError(400, "يجب إدخال سبب واضح لهذه الحالة");
      }
      if (nextStatus === "DELIVERED") {
        const settings = await db.settings.findUnique({ where: { id: 1 } });
        if (settings?.requireOtp) {
          const otp = String(body.otpCode || "").trim();
          if (order.otpAttempts >= OTP_MAX_ATTEMPTS) {
            throw new ApiError(429, "تم إيقاف إدخال الرمز بعد محاولات خاطئة كثيرة — تواصل مع الإدارة لإعادة توليده");
          }
          if (order.otpExpiresAt && order.otpExpiresAt.getTime() < Date.now()) {
            throw new ApiError(400, "انتهت صلاحية رمز التسليم — اطلب من الإدارة إعادة توليده");
          }
          if (!order.otpCode || otp !== order.otpCode) {
            const updatedAttempts = order.otpAttempts + 1;
            await db.order.update({ where: { id: orderId }, data: { otpAttempts: { increment: 1 } } });
            await logActivity({
              actorType: "REP",
              actorId: sessionRep.id,
              actorName: sessionRep.name,
              action: "OTP_FAILED",
              entityType: "ORDER",
              entityId: orderId,
              entityLabel: order.orderNumber,
              details: { المحاولة: updatedAttempts, الحد_الأقصى: OTP_MAX_ATTEMPTS },
            });
            if (updatedAttempts >= OTP_MAX_ATTEMPTS) {
              await notifyAdmins({
                type: "PROBLEM",
                title: `إيقاف رمز التسليم — ${order.orderNumber}`,
                body: `${sessionRep.name} أدخل رمزًا خاطئًا ${OTP_MAX_ATTEMPTS} مرات. أعد توليد الرمز بعد التأكد من العميل.`,
                orderId,
              });
              throw new ApiError(429, "تم إيقاف إدخال الرمز بعد محاولات خاطئة كثيرة — تواصل مع الإدارة");
            }
            throw new ApiError(
              400,
              `رمز تأكيد التسليم غير صحيح — تبقّى ${OTP_MAX_ATTEMPTS - updatedAttempts} محاولات`
            );
          }
        }
        if (settings?.requireReceiverName && !str(body.receiverSigned)) {
          throw new ApiError(400, "يجب تسجيل اسم المستلم");
        }
        if (settings?.requireProof && !str(body.deliveryProof)) {
          throw new ApiError(400, "يجب تسجيل إثبات التسليم");
        }
      }
    } else {
      const admin = await requireAdmin();
      actorType = "ADMIN";
      actorId = admin.id;
      actorName = admin.name;
      if (nextStatus !== "CANCELLED") {
        throw new ApiError(403, "الإدارة يمكنها فقط إلغاء الطلب هنا — تحديث التدفق للمندوب");
      }
      if (!str(body.reason)) throw new ApiError(400, "أدخل سبب إلغاء الطلب");
    }

    const now = new Date();
    const data: Partial<Order> = { status: nextStatus };
    let attemptsDelta = 0;

    switch (nextStatus) {
      case "ACCEPTED":
        data.acceptedAt = now;
        break;
      case "ON_WAY_PICKUP":
        data.onWayPickupAt = now;
        break;
      case "PICKED_UP":
        data.pickedUpAt = now;
        break;
      case "ON_WAY_DELIVERY":
        data.onWayDeliveryAt = now;
        if (order.otpCode) data.otpExpiresAt = new Date(now.getTime() + OTP_TTL_MS);
        break;
      case "DELIVERED": {
        data.deliveredAt = now;
        data.closedAt = now;
        data.receiverSigned = str(body.receiverSigned) ?? order.receiverSigned;
        data.deliveryProof = str(body.deliveryProof) ?? order.deliveryProof;
        if (order.collectionAmount > 0) {
          data.collectionCollected = body.collected !== false;
        }
        break;
      }
      case "FAILED":
        data.failureReason = str(body.reason);
        data.closedAt = now;
        attemptsDelta = 1;
        break;
      case "NO_ANSWER":
      case "REFUSED":
        data.failureReason = str(body.reason);
        attemptsDelta = 1;
        break;
      case "POSTPONED":
        data.postponeReason = str(body.reason);
        attemptsDelta = 1;
        break;
      case "CANCELLED":
        data.cancelReason = str(body.reason);
        data.closedAt = now;
        break;
    }

    const updated = await db.order.update({
      where: { id: orderId },
      data: {
        ...data,
        attempts: { increment: attemptsDelta },
      } as never,
    });

    await db.statusHistory.create({
      data: {
        orderId,
        status: nextStatus,
        note: str(body.reason) ?? str(body.note) ?? null,
        actorType,
        actorId,
        actorName,
      },
    });

    await logActivity({
      actorType,
      actorId,
      actorName,
      action: "STATUS_CHANGE",
      entityType: "ORDER",
      entityId: orderId,
      entityLabel: order.orderNumber,
      details: {
        من: ORDER_STATUS_LABELS[order.status],
        إلى: ORDER_STATUS_LABELS[nextStatus],
        السبب: str(body.reason) ?? null,
      },
    });

    // الإشعارات
    if (actorType === "REP") {
      if (nextStatus === "ACCEPTED") {
        await notifyAdmins({
          type: "ACCEPT",
          title: "قبول طلب",
          body: `${actorName} قبل الطلب ${order.orderNumber}`,
          orderId,
        });
      } else if (nextStatus === "DELIVERED") {
        await notifyAdmins({
          type: "DELIVERED",
          title: "تم التسليم بنجاح ✅",
          body: `${actorName} سلّم الطلب ${order.orderNumber}`,
          orderId,
        });
      } else if (ATTEMPT_STATUSES.includes(nextStatus)) {
        await notifyAdmins({
          type: "PROBLEM",
          title: `مشكلة في الطلب ${order.orderNumber}`,
          body: `${ORDER_STATUS_LABELS[nextStatus]} — ${str(body.reason) ?? ""} (المندوب: ${actorName})`,
          orderId,
        });
      }
    } else {
      // إلغاء إداري → إشعار المندوب
      if (order.repId) {
        await notify({
          targetType: "REP",
          repId: order.repId,
          type: "ORDER_UPDATED",
          title: "تم إلغاء الطلب",
          body: `الطلب ${order.orderNumber} أُلغي بطلب من الإدارة — ${str(body.reason) ?? ""}`,
          orderId,
        });
      }
    }

    return ok({ order: updated });
  });
}
