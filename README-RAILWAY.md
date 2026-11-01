# نشر NQEL على Railway

## 1) محليًا (للتجربة)
```bash
cp .env.example .env      # عدّل DATABASE_URL (PostgreSQL) و AUTH_SECRET
npm install               # سيُنشئ package-lock.json — ارفعه مع المشروع
npm run typecheck         # فحص أنواع TypeScript (البناء يتوقف عند أي خطأ)
npm run db:push
npm run db:seed           # admin@nqel.com / Nqel@2026 (للتجربة المحلية فقط)
npm run dev
```

## 2) على Railway
1. ارفع المشروع على GitHub ثم New Project ← Deploy from GitHub.
2. أضف خدمة **PostgreSQL** (New ← Database ← PostgreSQL) داخل نفس المشروع.
3. في Variables الخاصة بخدمة التطبيق:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (مرجع للقاعدة)
   - `AUTH_SECRET` = نص عشوائي طويل (32 حرفًا فأكثر)
   - `ADMIN_EMAIL` و `ADMIN_PASSWORD` (8 أحرف فأكثر). لو تركتهم فاضيين تُولَّد كلمة مرور مؤقتة وتظهر في لوج أول تشغيل.
4. Settings ← Networking ← **Generate Domain**.
5. الـ Healthcheck على `/api/health` مضبوط من `railway.json`.

الجداول وبيانات البداية تُجهَّز تلقائيًا عند كل تشغيل بدون مسح أي بيانات. لا حاجة لـ Volume.

## ملاحظات أمان
- رمز تسليم الطلب (OTP) من 6 أرقام: 5 محاولات خاطئة كحد أقصى، وصلاحيته 24 ساعة من خروج المندوب للتسليم، وكل محاولة فاشلة تُسجَّل في سجل العمليات. الإدارة تعيد توليده من صفحة الطلب.
- تغيير كلمة المرور أو PIN (أو تصفير PIN مندوب) ينهي كل الجلسات القديمة.
- PIN المندوب 6 خانات على الأقل، وكلمة مرور الإدارة 8 أحرف على الأقل.
- الدفعات التي تتجاوز المستحق تُرفض إلا إذا سُجّلت كـ«سلفة».
