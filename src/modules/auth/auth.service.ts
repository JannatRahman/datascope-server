import { Injectable, Inject, Logger } from "@nestjs/common";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { IncomingHttpHeaders } from "http";
import type { Request } from "express";

import { auth } from "../../lib/auth.js";
import { DRIZZLE_DB } from "../../core/constants.js";
import { RedisService } from "../../core/redis/redis.service.js";
import { roles } from "../../db/schema/auth.schema.js";
import * as schema from "../../db/schema/index.js";
import {
  ROLES,
  AuthenticatedUser,
  AuthenticatedSession,
  CachedSessionPayload,
} from "./types/auth.types.js";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE_DB)
    private readonly db: NodePgDatabase<typeof schema>,
    @Inject(RedisService)
    private readonly redisService: RedisService,
  ) {}

  /**
   * Extracts the raw session token from authorization header or Better Auth cookies.
   */
  extractSessionToken(req: Request): string | null {
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
   * Resolves the user's role name from the PostgreSQL roles table.
   * If roleId is missing or role record is not found, safely defaults to 'Viewer'.
   */
  async resolveUserRole(roleId?: string | null): Promise<string> {
    if (!roleId) {
      return ROLES.VIEWER;
    }

    try {
      const [roleRecord] = await this.db
        .select({ name: roles.name })
        .from(roles)
        .where(eq(roles.id, roleId))
        .limit(1);

      if (roleRecord && roleRecord.name) {
        return roleRecord.name;
      }
    } catch (error) {
      this.logger.warn(`Failed to resolve role for roleId ${roleId}: ${error}`);
    }

    return ROLES.VIEWER;
  }

  /**
   * Validates Better Auth session using Redis cache and auth.api.getSession.
   */
  async validateSession(
    headers: IncomingHttpHeaders,
    rawToken: string | null
  ): Promise<{ user: AuthenticatedUser; session: AuthenticatedSession } | null> {
    // 1. Check Redis cache first if rawToken is present
    if (rawToken) {
      try {
        const cachedRaw = await this.redisService.get(`auth:session:${rawToken}`);
        if (cachedRaw) {
          const cachedData: CachedSessionPayload = JSON.parse(cachedRaw);
          const expiresAtMs = new Date(cachedData.session.expiresAt).getTime();

          if (expiresAtMs > Date.now()) {
            return {
              user: cachedData.user,
              session: cachedData.session,
            };
          } else {
            // Expired cache entry: proactively purge
            await this.redisService.del(`auth:session:${rawToken}`);
          }
        }
      } catch (cacheError) {
        this.logger.warn(`Redis session cache lookup error: ${cacheError}`);
      }
    }

    // 2. Validate session using official Better Auth API
    let sessionData: any = null;
    try {
      sessionData = await auth.api.getSession({
        headers: fromNodeHeaders(headers),
      });
    } catch (authError) {
      this.logger.error(`Better Auth getSession error: ${authError}`);
      return null;
    }

    if (!sessionData || !sessionData.session || !sessionData.user) {
      return null;
    }

    // 3. Resolve role from PostgreSQL roles table
    const roleName = await this.resolveUserRole(sessionData.user.roleId);

    const enrichedUser: AuthenticatedUser = {
      id: sessionData.user.id,
      name: sessionData.user.name,
      email: sessionData.user.email,
      emailVerified: sessionData.user.emailVerified,
      image: sessionData.user.image,
      roleId: sessionData.user.roleId,
      roleName,
      createdAt: new Date(sessionData.user.createdAt),
      updatedAt: new Date(sessionData.user.updatedAt),
    };

    const session: AuthenticatedSession = {
      id: sessionData.session.id,
      expiresAt: new Date(sessionData.session.expiresAt),
      token: sessionData.session.token,
      createdAt: new Date(sessionData.session.createdAt),
      updatedAt: new Date(sessionData.session.updatedAt),
      ipAddress: sessionData.session.ipAddress,
      userAgent: sessionData.session.userAgent,
      userId: sessionData.session.userId,
    };

    // 4. Cache validated session in Redis with safe TTL respecting expiration
    try {
      const ttlSeconds = Math.floor(
        (session.expiresAt.getTime() - Date.now()) / 1000
      );

      if (ttlSeconds > 0) {
        // Safe cap of 60 seconds to avoid stale role privileges if updated in DB
        const cacheTtl = Math.min(ttlSeconds, 60);
        const cachePayload = JSON.stringify({ user: enrichedUser, session });

        await this.redisService.set(
          `auth:session:${session.token}`,
          cachePayload,
          cacheTtl
        );

        if (rawToken && rawToken !== session.token) {
          await this.redisService.set(
            `auth:session:${rawToken}`,
            cachePayload,
            cacheTtl
          );
        }
      }
    } catch (cacheSetError) {
      this.logger.warn(`Failed to cache session in Redis: ${cacheSetError}`);
    }

    return { user: enrichedUser, session };
  }

  /**
   * Invalidate session cache in Redis explicitly.
   */
  async invalidateSessionCache(token?: string | null): Promise<void> {
    if (!token) return;
    try {
      await this.redisService.del(`auth:session:${token}`);
    } catch (error) {
      this.logger.warn(`Failed to delete session cache for token: ${error}`);
    }
  }

  /**
   * Performs user logout by calling Better Auth signOut and invalidating Redis cache.
   */
  async logout(
    headers: IncomingHttpHeaders,
    rawToken: string | null,
    sessionToken?: string | null
  ): Promise<void> {
    // 1. Invalidate Redis cache keys immediately
    if (rawToken) {
      await this.invalidateSessionCache(rawToken);
    }
    if (sessionToken && sessionToken !== rawToken) {
      await this.invalidateSessionCache(sessionToken);
    }

    // 2. Call Better Auth signOut to revoke session in database
    try {
      await auth.api.signOut({
        headers: fromNodeHeaders(headers),
      });
    } catch (error) {
      this.logger.warn(`Better Auth signOut error: ${error}`);
    }
  }
}
