#!/bin/sh
# تشغيل NQEL على Railway: تجهيز قاعدة البيانات (PostgreSQL) ثم تشغيل السيرفر
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "✖ DATABASE_URL غير مضبوط — اربط خدمة PostgreSQL بالمشروع"
  exit 1
fi

echo "▶ تجهيز الجداول..."
node node_modules/prisma/build/index.js db push --skip-generate

echo "▶ إنشاء بيانات البداية (إن لم تكن موجودة)..."
node scripts/seed.mjs

export TZ="${TZ:-Africa/Cairo}"
export HOSTNAME="0.0.0.0"
export PORT="${PORT:-3000}"
export NODE_ENV=production

echo "▶ تشغيل السيرفر على المنفذ $PORT"
exec node .next/standalone/server.js
