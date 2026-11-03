import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  ApiError,
  checkRateLimit,
  clearFailures,
  registerFailure,
  clearSession,
  createSession,
  ok,
  verifySecret,
  wrap,
} from "@/lib/api";
import { logActivity } from "@/lib/services";

export async function POST(req: NextRequest) {
  return wrap(async () => {
    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "admin");
    const ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();

    if (mode === "admin") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      if (!email || !password) throw new ApiError(400, "أدخل البريد الإلكتروني وكلمة المرور");
      const rlKey = `admin:${ip}:${email}`;
      const rlAcct = `admin-acct:${email}`;
      await checkRateLimit(rlKey);
      await checkRateLimit(rlAcct, 30);
      const admin = await db.admin.findUnique({ where: { email } });
      if (!admin || !admin.active) {
        await registerFailure(rlKey);
        await registerFailure(rlAcct);
        throw new ApiError(401, "بيانات الدخول غير صحيحة");
      }
      const valid = await verifySecret(password, admin.passwordHash);
      if (!valid) {
        await registerFailure(rlKey);
        await registerFailure(rlAcct);
        throw new ApiError(401, "بيانات الدخول غير صحيحة");
      }
      await clearFailures(rlKey);
      await createSession({
        sub: String(admin.id),
        role: "ADMIN",
        name: admin.name,
        ver: admin.sessionVersion,
      });
      await logActivity({
        actorType: "ADMIN",
        actorId: admin.id,
        actorName: admin.name,
        action: "LOGIN",
        entityType: "AUTH",
        entityId: admin.id,
        entityLabel: admin.email,
      });
      return NextResponse.json({ role: "ADMIN", name: admin.name });
    }

    // تسجيل دخول المندوب بالكود + PIN
    const code = String(body.code || "").trim();
    const pin = String(body.pin || "").trim();
    if (!code || !pin) throw new ApiError(400, "أدخل كود الدخول ورمز PIN");
    const rlKey = `rep:${ip}:${code}`;
    const rlAcct = `rep-acct:${code}`;
    await checkRateLimit(rlKey);
    await checkRateLimit(rlAcct, 30);
    const rep = await db.representative.findUnique({ where: { code } });
    if (!rep) {
      await registerFailure(rlKey);
        await registerFailure(rlAcct);
      throw new ApiError(401, "كود الدخول غير صحيح");
    }
    if (!rep.active) throw new ApiError(403, "هذا الحساب موقوف — تواصل مع الإدارة");
    const valid = await verifySecret(pin, rep.pinHash);
    if (!valid) {
      await registerFailure(rlKey);
        await registerFailure(rlAcct);
      throw new ApiError(401, "رمز PIN غير صحيح");
    }
    await clearFailures(rlKey);
    await createSession({ sub: String(rep.id), role: "REP", name: rep.name, ver: rep.sessionVersion });
    await logActivity({
      actorType: "REP",
      actorId: rep.id,
      actorName: rep.name,
      action: "LOGIN",
      entityType: "AUTH",
      entityId: rep.id,
      entityLabel: rep.code,
    });
    return ok({ role: "REP", name: rep.name });
  });
}

export async function DELETE() {
  return wrap(async () => {
    await clearSession();
    return ok({ success: true });
  });
}
