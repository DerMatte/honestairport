import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

// Social providers are registered only when their credentials exist, so dev
// and CI builds work without any OAuth apps configured — the login page
// simply doesn't render the missing buttons.
const githubEnabled = Boolean(
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
);
const appleEnabled = Boolean(
  process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, url);
    },
    revokeSessionsOnPasswordReset: true,
  },
  emailVerification: {
    // Verification failing (Resend outage, missing key) must not block the
    // signup itself — the user can re-request from the login screen later.
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendVerificationEmail(user.email, url);
      } catch (error) {
        console.error("Failed to send verification email:", error);
      }
    },
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    ...(githubEnabled
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          },
        }
      : {}),
    ...(appleEnabled
      ? {
          apple: {
            clientId: process.env.APPLE_CLIENT_ID!,
            // Pre-generated ES256 JWT (<=180 days) — rotate via env, see README.
            clientSecret: process.env.APPLE_CLIENT_SECRET!,
          },
        }
      : {}),
  },
  // Apple's OAuth flow POSTs back from appleid.apple.com.
  trustedOrigins: appleEnabled ? ["https://appleid.apple.com"] : [],
  // nextCookies must stay last so it can set cookies from server actions.
  plugins: [nextCookies()],
});
