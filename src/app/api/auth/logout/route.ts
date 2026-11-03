import { ok, wrap, clearSession } from "@/lib/api";

export async function POST() {
  return wrap(async () => {
    await clearSession();
    return ok({ success: true });
  });
}
