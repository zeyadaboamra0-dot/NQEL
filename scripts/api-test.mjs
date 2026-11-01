/**
 * NQEL API smoke test — يختبر السيناريو الكامل من الإدارة للمندوب
 * Run: node scripts/api-test.mjs
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";
let cookie = "";
let repCookie = "";

async function api(path, opts = {}, useRep = false) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(useRep ? { cookie: repCookie } : { cookie }),
      ...(opts.headers || {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    const c = setCookie.split(";")[0];
    if (useRep) repCookie = c;
    else cookie = c;
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${json.error}`);
  return json;
}

let pass = 0, fail = 0;
function ok(name, cond, extra = "") {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${extra}`); }
}

const ts = Date.now().toString().slice(-6);

async function main() {
  // 1) دخول الإدارة
  await api("/api/auth/login", { method: "POST", body: JSON.stringify({ mode: "admin", email: "admin@nqel.com", password: "Nqel@2026" }) });
  ok("1. دخول الإدارة", true);

  const me = await api("/api/auth/me");
  ok("2. جلسة الإدارة", me.role === "ADMIN");

  // 2) إنشاء مندوب
  const repRes = await api("/api/reps", { method: "POST", body: JSON.stringify({ name: "محمود الساعي", phone: "01000000" + ts.slice(-2), pin: "246810", defaultCommission: 15 }) });
  const repCode = repRes.rep.code;
  ok("3. إنشاء مندوب بكود", Boolean(repCode), repCode);

  // كود مكرر يُرفض
  let dupErr = "";
  try { await api("/api/reps", { method: "POST", body: JSON.stringify({ name: "x", pin: "111111", code: repCode }) }); } catch (e) { dupErr = e.message; }
  ok("4. رفض كود مكرر", dupErr.includes("مستخدم"));

  // 3) إنشاء طلب بدون إسناد
  const types = await api("/api/shipment-types");
  const order1 = await api("/api/orders", { method: "POST", body: JSON.stringify({
    customerName: "أحمد التجاري", phone: "0122345678" + ts.slice(-1), governorate: "القاهرة", city: "مدينة نصر",
    addressDetail: "شارع عباس العقاد، عمارة 12", pickupPlace: "مخزن التجاري", shipmentTypeId: types.types[0].id,
    collectionAmount: 550, deliveryFee: 60, shipmentCost: 20, additionalExpenses: 5,
    expectedDeliveryAt: new Date(Date.now() + 86400000).toISOString(),
  }) });
  ok("5. إنشاء طلب ورقم تلقائي", order1.order.orderNumber.startsWith("NQ-"), order1.order.orderNumber);
  ok("6. صافي ربح الطلب = 60-20-5-0 = 35", order1.order.netProfit === 35, order1.order.netProfit);
  ok("7. الحالة جديدة", order1.order.status === "NEW");
  const otp = order1.order.otpCode;
  ok("8. توليد OTP", /^\d{6}$/.test(otp ?? ""));

  // عميل مكرر: طلب ثانٍ بنفس الهاتف → نفس العميل
  const phone = order1.order.phone;
  const order2 = await api("/api/orders", { method: "POST", body: JSON.stringify({
    customerName: "أحمد التجاري", phone, governorate: "الجيزة", city: "الدقي",
    addressDetail: "شارع التحرير", pickupPlace: "مخزن التجاري", shipmentTypeId: types.types[1].id,
    collectionAmount: 1200, deliveryFee: 75, shipmentCost: 25, repId: repRes.rep.id, repCommission: 15,
  }) });
  ok("9. ربط الطلب بالعميل الموجود", order2.order.customerId === order1.order.customerId);
  ok("10. إسناد مباشر عند الإنشاء", order2.order.status === "ASSIGNED" && order2.order.repId === repRes.rep.id);

  // إسناد الطلب الأول
  await api(`/api/orders/${order1.order.id}/assign`, { method: "POST", body: JSON.stringify({ repId: repRes.rep.id }) });
  ok("11. إسناد الطلب الأول", true);

  // مندوب: دخول
  await api("/api/auth/login", { method: "POST", body: JSON.stringify({ mode: "rep", code: repCode, pin: "246810" }) }, true);
  ok("12. دخول المندوب بالكود+PIN", true);

  const repOrders = await api("/api/rep/orders", {}, true);
  ok("13. المندوب يرى طلباته فقط", repOrders.total === 2, repOrders.total);

  // المندوب لا يرى API الإدارة
  let guardErr = "";
  try { await api("/api/orders", {}, true); } catch (e) { guardErr = e.message; }
  ok("14. حماية API الإدارة من المندوب", guardErr.includes("401") || guardErr.includes("الإدارة"));

  // المندوب لا يرى طلب غير المسند إليه (أنشئ طلب ثالث بدون إسناد)
  const order3 = await api("/api/orders", { method: "POST", body: JSON.stringify({
    customerName: "سارة", phone: "01111" + ts, governorate: "الإسكندرية", city: "سيدي جابر",
    addressDetail: "شارع أبو قير", pickupPlace: "متجر سارة", shipmentTypeId: types.types[1].id,
  }) });
  let otherErr = "";
  try { await api(`/api/rep/orders/${order3.order.id}`, {}, true); } catch (e) { otherErr = e.message; }
  ok("15. منع المندوب من طلب غيره", otherErr.includes("غير مُسند إليك"));

  // تدفق الحالات للطلب الأول
  const flow = [
    ["ACCEPTED", {}], ["ON_WAY_PICKUP", {}], ["PICKED_UP", {}], ["ON_WAY_DELIVERY", {}],
  ];
  for (const [st, extra] of flow) {
    await api(`/api/orders/${order1.order.id}/status`, { method: "POST", body: JSON.stringify({ status: st, ...extra }) }, true);
  }
  ok("16. تسلسل الحالات حتى الطريق للعميل", true);

  // OTP خاطئ يُرفض
  let otpErr = "";
  try { await api(`/api/orders/${order1.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "DELIVERED", otpCode: "000000", receiverSigned: "أمين المخزن" }) }, true); } catch (e) { otpErr = e.message; }
  ok("17. رفض OTP خاطئ مع عدّ المحاولات المتبقية", otpErr.includes("تبقّى"), otpErr);

  // تسليم صحيح
  await api(`/api/orders/${order1.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "DELIVERED", otpCode: otp, receiverSigned: "أمين المخزن", collected: true }) }, true);
  ok("18. تسليم ناجح بـ OTP صحيح", true);

  // تأجيل بدون سبب يُرفض — وانتقال غير صحيح من ASSIGNED يُرفض أيضًا
  let reasonErr = "";
  try { await api(`/api/orders/${order2.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "POSTPONED" }) }, true); } catch (e) { reasonErr = e.message; }
  ok("19. رفض انتقال غير صالح أو سبب مفقود", reasonErr.includes("سبب") || reasonErr.includes("لا يمكن الانتقال"), reasonErr);

  // تدفق صحيح: قبول ثم انطلاق للاستلام ثم تأجيل بسبب
  await api(`/api/orders/${order2.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "ACCEPTED" }) }, true);
  await api(`/api/orders/${order2.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "ON_WAY_PICKUP" }) }, true);
  await api(`/api/orders/${order2.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "POSTPONED", reason: "العميل طلب التسليم غدًا" }) }, true);
  const attempts = await api(`/api/orders/${order2.order.id}`);
  ok("20. عداد المحاولات", attempts.order.attempts === 1, attempts.order.attempts);

  // إعادة إسناد الطلب الثاني لمندوب آخر؟ ننشئ مندوب ثاني
  const rep2 = await api("/api/reps", { method: "POST", body: JSON.stringify({ name: "كريم التوصيل", pin: "135792" }) });
  await api(`/api/orders/${order2.order.id}/assign`, { method: "POST", body: JSON.stringify({ repId: rep2.rep.id }) });
  const reassigned = await api(`/api/orders/${order2.order.id}`);
  ok("21. إعادة إسناد + إرجاع للحالة بانتظار القبول", reassigned.order.status === "ASSIGNED" && reassigned.order.repId === rep2.rep.id, reassigned.order.status);

  // إلغاء إداري للطلب الثالث
  await api(`/api/orders/${order3.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "CANCELLED", reason: "تجربة إلغاء" }) });
  ok("22. إلغاء إداري بسبب", true);

  // الإحصائيات
  const stats = await api("/api/stats/dashboard?days=30");
  ok("23. إحصائيات: 3 طلبات", stats.cards.totalOrders === 3, stats.cards.totalOrders);
  ok("24. تسليم واحد", stats.cards.deliveredOrders === 1);
  ok("25. الإيراد = 60", stats.cards.revenue === 60, stats.cards.revenue);
  ok("26. صافي الربح = 60-40 = 20 (مع عمولة المندوب 15)", stats.cards.netProfit === 20, stats.cards.netProfit);
  ok("27. محصل = 550", stats.cards.collectedTotal === 550, stats.cards.collectedTotal);

  // مستحقات المندوب الأول = 15 (طلب واحد مسلّم)
  const dues = await api("/api/payouts");
  const rep1Due = dues.dues.find((d) => d.repId === repRes.rep.id);
  ok("28. مستحق المندوب الأول = 15", rep1Due && rep1Due.totalCommission === 15, JSON.stringify(rep1Due));

  // دفعة للمندوب
  await api("/api/payouts", { method: "POST", body: JSON.stringify({ repId: repRes.rep.id, amount: 10, note: "دفعة تجربة" }) });
  let overErr = "";
  try { await api("/api/payouts", { method: "POST", body: JSON.stringify({ repId: repRes.rep.id, amount: 100000 }) }); } catch (e) { overErr = e.message; }
  ok("رفض دفعة تتجاوز المستحق", overErr.includes("أكبر من المستحق"), overErr);
  const dues2 = await api("/api/payouts");
  const rep1Due2 = dues2.dues.find((d) => d.repId === repRes.rep.id);
  ok("29. المتبقي بعد دفعة = 5", rep1Due2.remaining === 5, rep1Due2.remaining);

  // مصروف تشغيلي 30 → صافي الربح = 20 - 30 = -10
  await api("/api/expenses", { method: "POST", body: JSON.stringify({ title: "وقود", amount: 30 }) });
  const stats2 = await api("/api/stats/dashboard?days=30");
  ok("30. صافي الربح بعد مصروف تشغيلي = -10", stats2.cards.netProfit === -10, stats2.cards.netProfit);

  // الإشعارات
  const notifs = await api("/api/notifications");
  ok("31. إشعارات الإدارة وصلت", notifs.total >= 3, notifs.total);

  // سجل العمليات
  const act = await api("/api/activity?pageSize=50");
  ok("32. سجل العمليات مسجل", act.total >= 10, act.total);
  const hasStatusChange = act.logs.some((l) => l.action === "STATUS_CHANGE");
  ok("33. تسجيل تغييرات الحالة", hasStatusChange);

  // تقارير
  const report = await api("/api/reports");
  ok("34. تقرير: نجاح 1/3", report.summary.successRate === 33, report.summary.successRate);

  // المندوب: مستحقاته
  const repEarnings = await api("/api/rep/earnings", {}, true);
  ok("35. مستحقات المندوب الأول", repEarnings.totalEarned === 15 && repEarnings.remaining === 5, JSON.stringify(repEarnings));

  // منع تعديل طلب مُسلّم؟ الإدارة تسمح بالتعديل (صلاحيتها) — لكن المندوب لا يستطيع تغيير حالته
  let deliveredErr = "";
  try { await api(`/api/orders/${order1.order.id}/status`, { method: "POST", body: JSON.stringify({ status: "FAILED" }) }, true); } catch (e) { deliveredErr = e.message; }
  ok("36. منع تغيير حالة طلب مُسلّم", deliveredErr.includes("مُغلق"));

  console.log(`\n=== النتيجة: ${pass} نجاح / ${fail} فشل ===`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
