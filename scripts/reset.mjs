/** تصفير قاعدة البيانات لحالة نظيفة (للتجربة المحلية فقط). */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production" && process.env.ALLOW_RESET !== "yes") {
  console.error("✖ ممنوع التصفير في الإنتاج (اضبط ALLOW_RESET=yes إن كنت متأكدًا)");
  process.exit(1);
}

const db = new PrismaClient();

async function main() {
  await db.rateLimit.deleteMany();
  await db.notification.deleteMany();
  await db.statusHistory.deleteMany();
  await db.activityLog.deleteMany();
  await db.payout.deleteMany();
  await db.expense.deleteMany();
  await db.order.deleteMany();
  await db.customer.deleteMany();
  await db.representative.deleteMany();
  await db.shipmentType.deleteMany();
  await db.admin.deleteMany();

  await db.admin.create({
    data: {
      email: (process.env.ADMIN_EMAIL || "admin@nqel.com").toLowerCase(),
      name: "مدير NQEL",
      passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD || "Nqel@2026", 10),
    },
  });
  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  for (const name of ["مستندات وأوراق", "طرود ومنتجات", "طلبات تجارية", "شحنات كبيرة", "أغراض شخصية", "أخرى"]) {
    await db.shipmentType.create({ data: { name } });
  }
  console.log("✔ تم التصفير");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
