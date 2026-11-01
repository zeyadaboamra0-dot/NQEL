/**
 * تجهيز قاعدة بيانات NQEL: حساب الإدارة + الإعدادات + أنواع الشحنات.
 * آمن للتشغيل أكثر من مرة (لا يكرر ولا يمسح شيئًا).
 * متغيرات اختيارية: ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const db = new PrismaClient();
const isProd = process.env.NODE_ENV === "production";

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@nqel.com").trim().toLowerCase();
  const existing = await db.admin.findUnique({ where: { email } });
  if (!existing) {
    let password = process.env.ADMIN_PASSWORD;
    let generated = false;
    if (!password) {
      if (isProd) {
        password = randomBytes(9).toString("base64url");
        generated = true;
      } else {
        password = "Nqel@2026";
      }
    }
    await db.admin.create({
      data: { email, name: "مدير NQEL", passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`✔ تم إنشاء حساب الإدارة: ${email}`);
    if (generated) {
      console.log(`⚠ كلمة المرور المؤقتة (احفظها وغيّرها من الإعدادات): ${password}`);
    } else if (!process.env.ADMIN_PASSWORD) {
      console.log("• كلمة المرور الافتراضية للتجربة المحلية: Nqel@2026");
    }
  } else {
    console.log("• حساب الإدارة موجود");
  }

  await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const types = ["مستندات وأوراق", "طرود ومنتجات", "طلبات تجارية", "شحنات كبيرة", "أغراض شخصية", "أخرى"];
  for (const name of types) {
    await db.shipmentType.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log("✔ الإعدادات وأنواع الشحنات جاهزة");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
