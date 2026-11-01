// ينسخ الملفات الثابتة إلى مجلد standalone بعد البناء (يعمل على أي نظام)
import { cpSync, existsSync } from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(standalone)) {
  console.error("✖ .next/standalone غير موجود — تأكد من output: 'standalone' في next.config.ts");
  process.exit(1);
}
cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
if (existsSync("public")) cpSync("public", `${standalone}/public`, { recursive: true });
console.log("✔ تم نسخ static و public إلى standalone");
