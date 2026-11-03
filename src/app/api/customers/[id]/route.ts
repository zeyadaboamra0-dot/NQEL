import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ApiError, ok, requireAdmin, wrap } from "@/lib/api";
import { diffFields, logActivity, str } from "@/lib/services";

// GET /api/customers/[id] — ملف العميل الكامل + كل تعاملاته
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    await requireAdmin();
    const { id } = await params;
    const customer = await db.customer.findUnique({
      where: { id: Number(id) },
      include: {
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            rep: { select: { name: true } },
            shipmentType: { select: { name: true } },
          },
        },
      },
    });
    if (!customer) throw new ApiError(404, "العميل غير موجود");

    const orders = customer.orders;
    const delivered = orders.filter((o) => o.status === "DELIVERED");
    const cancelled = orders.filter((o) => o.status === "CANCELLED");
    const failed = orders.filter((o) => ["FAILED", "NO_ANSWER", "REFUSED"].includes(o.status));
    const dates = [...orders].map((o) => o.createdAt).sort((a, b) => a.getTime() - b.getTime());
    const stats = {
      totalOrders: orders.length,
      deliveredCount: delivered.length,
      cancelledCount: cancelled.length,
      failedCount: failed.length,
      collectedTotal: orders.filter((o) => o.collectionCollected).reduce((s, o) => s + o.collectionAmount, 0),
      uncollectedTotal: orders
        .filter((o) => !o.collectionCollected && o.status === "DELIVERED")
        .reduce((s, o) => s + o.collectionAmount, 0),
      firstOrderAt: dates[0] ?? null,
      lastOrderAt: dates[dates.length - 1] ?? null,
      isRepeat: orders.length > 1,
    };

    const { orders: _o, ...customerData } = customer;
    return ok({ customer: customerData, stats, orders });
  });
}

// PATCH /api/customers/[id] — تعديل بيانات العميل
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return wrap(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const customerId = Number(id);
    const existing = await db.customer.findUnique({ where: { id: customerId } });
    if (!existing) throw new ApiError(404, "العميل غير موجود");
    const body = await req.json();

    if (body.phone && String(body.phone).trim() !== existing.phone) {
      const taken = await db.customer.findUnique({ where: { phone: String(body.phone).trim() } });
      if (taken) throw new ApiError(400, "رقم الهاتف مستخدم بالفعل للعميل: " + taken.name);
    }

    if ("name" in body && !str(body.name)) throw new ApiError(400, "اسم العميل مطلوب");
    if ("phone" in body && !str(body.phone)) throw new ApiError(400, "رقم الهاتف مطلوب");

    const changes = diffFields(existing as unknown as Record<string, unknown>, body, [
      "name", "phone", "altPhone", "governorate", "city", "address", "notes",
    ]);

    const customer = await db.customer.update({
      where: { id: customerId },
      data: {
        name: "name" in body ? String(body.name).trim() : undefined,
        phone: "phone" in body ? String(body.phone).trim() : undefined,
        altPhone: "altPhone" in body ? str(body.altPhone) : undefined,
        governorate: "governorate" in body ? str(body.governorate) : undefined,
        city: "city" in body ? str(body.city) : undefined,
        address: "address" in body ? str(body.address) : undefined,
        notes: "notes" in body ? str(body.notes) : undefined,
      },
    });

    await logActivity({
      actorType: "ADMIN",
      actorId: admin.id,
      actorName: admin.name,
      action: "UPDATE",
      entityType: "CUSTOMER",
      entityId: customerId,
      entityLabel: customer.name,
      details: { تغييرات: changes },
    });
    return ok({ customer });
  });
}
