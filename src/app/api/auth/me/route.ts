import { getSession, ok, wrap } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  return wrap(async () => {
    const session = await getSession();
    if (!session) return ok({ authenticated: false });
    if (session.role === "ADMIN") {
      const admin = await db.admin.findUnique({ where: { id: Number(session.sub) } });
      if (!admin || !admin.active) return ok({ authenticated: false });
      return ok({
        authenticated: true,
        role: "ADMIN",
        name: admin.name,
        email: admin.email,
      });
    }
    const rep = await db.representative.findUnique({ where: { id: Number(session.sub) } });
    if (!rep || !rep.active) return ok({ authenticated: false });
    return ok({
      authenticated: true,
      role: "REP",
      name: rep.name,
      repId: rep.id,
      code: rep.code,
    });
  });
}
