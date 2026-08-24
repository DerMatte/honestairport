import { z } from "zod";
import { auth } from "@/lib/auth";
import { unlockFromReceipt } from "@/lib/whop-access";

const bodySchema = z.object({
  receiptId: z.string().min(4).max(80),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_receipt" }, { status: 400 });
  }

  const session = await auth.api.getSession({ headers: request.headers }).catch(
    () => null,
  );

  const result = await unlockFromReceipt(parsed.data.receiptId.trim(), process.env, {
    accountUserId: session?.user.id,
  });
  if (result.ok) {
    return Response.json({ ok: true, username: result.username });
  }

  return Response.json({ error: result.error }, { status: result.status });
}
