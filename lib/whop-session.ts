import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import {
  readWhopSessionPassword,
  WHOP_SESSION_COOKIE,
  type WhopEnv,
  type WhopSessionData,
} from "@/lib/whop-gate";

export type { WhopSessionData };

export function whopSessionOptions(env: WhopEnv = process.env): SessionOptions | null {
  const password = readWhopSessionPassword(env);
  if (!password) {
    return null;
  }
  return {
    password,
    cookieName: WHOP_SESSION_COOKIE,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getWhopSession(
  env: WhopEnv = process.env,
): Promise<IronSession<WhopSessionData> | null> {
  const options = whopSessionOptions(env);
  if (!options) {
    return null;
  }
  const store = await cookies();
  return getIronSession<WhopSessionData>(store, options);
}
