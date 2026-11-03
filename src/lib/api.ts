// أدوات الخادم: استجابات API، أخطاء، جلسات وصلاحيات
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { Admin, Representative } from "@prisma/client";

const DEV_FALLBACK_SECRET = "nqel-dev-only-secret-do-not-use-in-production";
if (process.env.NODE_ENV === "production" && !process.env.AUTH_SECRET && process.env.NEXT_PHASE !== "phase-production-build") {
  throw new Error("AUTH_SECRET غير مضبوط — أضفه في متغيرات البيئة قبل التشغيل");
}
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || DEV_FALLBACK_SECRET);
const COOKIE_NAME = "nqel_session";
const MAX_AGE = 60 * 60 * 24 * 14; // أسبوعان

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data as Record<string, unknown>, { status });
}

export function handleError(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[API ERROR]", err);
  const message = err instanceof Error ? err.message : "خطأ غير متوقع في الخادم";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function wrap<T>(fn: () => Promise<T>) {
  try {
    return await fn();
  } catch (err) {
    return handleError(err);
  }
}

// ==================== الجلسات ====================

export type SessionPayload = {
  sub: string;
  role: "ADMIN" | "REP";
  name: string;
  ver: number;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return token;
}

export async function clearSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, "", { httpOnly: true, path: "/", maxAge: 0 });
}

type Resolved =
  | { session: SessionPayload; admin: Admin; rep?: undefined }
  | { session: SessionPayload; rep: Representative; admin?: undefined };

// يقرأ الجلسة ويتحقق من قاعدة البيانات: الحساب مفعّل + إصدار الجلسة مطابق
// (تغيير كلمة المرور/PIN يرفع الإصدار فتنتهي كل الجلسات القديمة فورًا)
async function resolveSession(): Promise<Resolved | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.sub || !payload.role) return null;
    const id = Number(payload.sub);
    const ver = Number(payload.ver);
    if (!Number.isInteger(id) || !Number.isInteger(ver)) return null;
    const session: SessionPayload = {
      sub: String(payload.sub),
      role: payload.role as "ADMIN" | "REP",
      name: String(payload.name ?? ""),
      ver,
    };
    if (session.role === "ADMIN") {
      const admin = await db.admin.findUnique({ where: { id } });
      if (!admin || !admin.active || admin.sessionVersion !== ver) return null;
      return { session, admin };
    }
    if (session.role === "REP") {
      const rep = await db.representative.findUnique({ where: { id } });
      if (!rep || !rep.active || rep.sessionVersion !== ver) return null;
      return { session, rep };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const r = await resolveSession();
  return r ? r.session : null;
}

export async function requireAdmin() {
  const r = await resolveSession();
  if (!r || !r.admin) {
    throw new ApiError(401, "غير مصرح — يتطلب صلاحيات الإدارة");
  }
  return r.admin;
}

export async function requireRep() {
  const r = await resolveSession();
  if (!r || !r.rep) {
    throw new ApiError(401, "غير مصرح — يتطلب حساب مندوب");
  }
  return r.rep;
}

// ==================== حماية من التخمين (مخزنة في قاعدة البيانات) ====================

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export async function checkRateLimit(key: string, max = MAX_ATTEMPTS) {
  const entry = await db.rateLimit.findUnique({ where: { key } });
  if (entry && entry.resetAt.getTime() > Date.now() && entry.count >= max) {
    throw new ApiError(429, "محاولات كثيرة — حاول مرة أخرى بعد 15 دقيقة");
  }
}

export async function registerFailure(key: string, windowMs = WINDOW_MS) {
  const now = Date.now();
  const entry = await db.rateLimit.findUnique({ where: { key } });
  if (!entry || entry.resetAt.getTime() <= now) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now + windowMs) },
      update: { count: 1, resetAt: new Date(now + windowMs) },
    });
  } else {
    await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  }
  // تنظيف الصفوف المنتهية أحيانًا
  if (Math.random() < 0.02) {
    await db.rateLimit.deleteMany({ where: { resetAt: { lt: new Date() } } }).catch(() => {});
  }
}

export async function clearFailures(key: string) {
  await db.rateLimit.deleteMany({ where: { key } });
}

export async function hashSecret(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function verifySecret(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}
