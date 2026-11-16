import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db } from "../config/database.js";
import * as schema from "../db/schema/auth.schema.js";

const trustedOrigins = [
  process.env['CLIENT_URL'],
  process.env['BETTER_AUTH_URL'],
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost',
  'http://127.0.0.1',
].filter((origin): origin is string => Boolean(origin));

export const auth = betterAuth({
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env['GOOGLE_CLIENT_ID'] || "",
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] || "",
    },
  },
  plugins: [
    // Official Better Auth plugin to support Authorization: Bearer <token>
    // alongside standard HTTP-only session cookies
    bearer(),
  ],
  user: {
    additionalFields: {
      roleId: {
        type: "string",
        required: false,
        input: false, // Security: Disallow client from supplying roleId during registration
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (userData) => {
          // Security: Server-side assignment of Viewer role for new registrations
          try {
            const [viewerRole] = await db
              .select({ id: schema.roles.id })
              .from(schema.roles)
              .where(eq(schema.roles.name, "Viewer"))
              .limit(1);

            if (viewerRole) {
              return {
                data: {
                  ...userData,
                  roleId: viewerRole.id,
                },
              };
            }
          } catch (error) {
            console.warn("[Better Auth] Warning: could not query Viewer role at registration:", error);
          }
          return { data: userData };
        },
      },
    },
  },
});
