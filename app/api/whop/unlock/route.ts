import { z } from "zod";
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

  const result = await unlockFromReceipt(parsed.data.receiptId.trim());
  if (result.ok) {
    return Response.json({ ok: true, username: result.username });
  }

  return Response.json({ error: result.error }, { status: result.status });
}
