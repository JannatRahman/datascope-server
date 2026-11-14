import { Request, Response, NextFunction } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth.js";
import { db } from "../config/database.js";
import { redisClient } from "../config/redis.js";
import { roles } from "../db/schema/auth.schema.js";

// Extend Express Request interface with authenticated user and session
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null | undefined;
        roleId?: string | null | undefined;
        roleName?: string | undefined;
        createdAt: Date;
        updatedAt: Date;
      } | undefined;
      session?: {
        id: string;
        expiresAt: Date;
        token: string;
        createdAt: Date;
        updatedAt: Date;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
        userId: string;
      } | undefined;
    }
  }
}

/**
 * Extracts session token from Authorization header or Better Auth cookies.
 */
function extractSessionToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  if (req.cookies) {
    if (req.cookies["better-auth.session_token"]) {
      return req.cookies["better-auth.session_token"];
    }
    if (req.cookies["__Secure-better-auth.session_token"]) {
      return req.cookies["__Secure-better-auth.session_token"];
    }
  }

  return null;
}

/**
 * Invalidate a session in Redis cache (e.g. on logout or revocation).
 */
export async function invalidateSessionCache(token: string): Promise<void> {
  try {
    if (redisClient.isOpen && token) {
      await redisClient.del(`auth:session:${token}`);
    }
  } catch (error) {
    console.error("Failed to invalidate session cache in Redis:", error);
  }
}

/**
 * Express middleware to securely validate Better Auth sessions.
 * 
 * Flow:
 * 1. Checks Redis cache for active validated session.
 * 2. If not cached, invokes official auth.api.getSession with request headers.
 * 3. Enriches authenticated user with role name from PostgreSQL roles table.
 * 4. Caches validated session in Redis respecting expiration and logout invalidation.
 * 5. Attaches req.user and req.session.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const rawToken = extractSessionToken(req);

    // 1. Check Redis cache first if token exists and Redis is connected
    if (rawToken && redisClient.isOpen) {
      try {
        const cached = await redisClient.get(`auth:session:${rawToken}`);
        if (cached) {
          const data = JSON.parse(cached);
          const expiresAtMs = new Date(data.session.expiresAt).getTime();

          // Ensure session is not expired
          if (expiresAtMs > Date.now()) {
            req.user = data.user;
            req.session = data.session;
            return next();
          } else {
            await redisClient.del(`auth:session:${rawToken}`);
          }
        }
      } catch (cacheError) {
        console.warn("Redis session cache lookup error (falling back to database):", cacheError);
      }
    }

    // 2. Validate session using official Better Auth API
    const sessionData = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!sessionData || !sessionData.session || !sessionData.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid or expired session",
      });
    }

    // 3. Resolve role name from roles table
    let roleName = "Viewer";
    if (sessionData.user.roleId) {
      try {
        const [role] = await db
          .select({ name: roles.name })
          .from(roles)
          .where(eq(roles.id, sessionData.user.roleId))
          .limit(1);

        if (role) {
          roleName = role.name;
        }
      } catch (dbError) {
        console.warn("Failed to fetch role from database:", dbError);
      }
    }

    const enrichedUser = {
      ...sessionData.user,
      roleName,
    };

    req.user = enrichedUser;
    req.session = sessionData.session;

    // 4. Cache validated session in Redis with TTL respecting session expiration
    if (redisClient.isOpen) {
      try {
        const ttlSeconds = Math.floor(
          (new Date(sessionData.session.expiresAt).getTime() - Date.now()) / 1000
        );

        if (ttlSeconds > 0) {
          // Cache with max window of 60 seconds to balance performance and rapid logout invalidation
          const cacheTtl = Math.min(ttlSeconds, 60);
          const cachePayload = JSON.stringify({
            user: enrichedUser,
            session: sessionData.session,
          });

          await redisClient.setEx(
            `auth:session:${sessionData.session.token}`,
            cacheTtl,
            cachePayload
          );

          if (rawToken && rawToken !== sessionData.session.token) {
            await redisClient.setEx(
              `auth:session:${rawToken}`,
              cacheTtl,
              cachePayload
            );
          }
        }
      } catch (cacheSetError) {
        console.warn("Failed to cache session in Redis:", cacheSetError);
      }
    }

    return next();
  } catch (error) {
    console.error("Authentication middleware error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
    });
  }
}
