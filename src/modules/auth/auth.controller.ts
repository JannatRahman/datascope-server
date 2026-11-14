import {
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  Inject,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import type { Request } from "express";

import { AuthService } from "./auth.service.js";
import { BetterAuthGuard } from "./guards/better-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";
import { Roles } from "./decorators/roles.decorator.js";
import { CurrentUser } from "./decorators/current-user.decorator.js";
import { ROLES, AuthenticatedUser } from "./types/auth.types.js";

@Controller("api/v1/auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  /**
   * Retrieves the current authenticated user and session.
   */
  @Get("me")
  @UseGuards(BetterAuthGuard)
  getMe(@Req() req: Request) {
    return {
      success: true,
      message: "Authenticated user session retrieved successfully",
      user: req.user,
      session: req.session,
    };
  }

  /**
   * Logs out the user, invalidates the Better Auth session, and purges Redis cache.
   */
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(BetterAuthGuard)
  async logout(@Req() req: Request) {
    const rawToken = this.authService.extractSessionToken(req);
    const sessionToken = req.session?.token;

    await this.authService.logout(req.headers, rawToken, sessionToken);

    return {
      success: true,
      message: "Logged out successfully",
    };
  }

  /**
   * RBAC verification: Administrator role only.
   */
  @Get("admin-only")
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.ADMINISTRATOR)
  adminOnly(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      message: "Administrator access granted",
      user: {
        id: user.id,
        email: user.email,
        roleName: user.roleName,
      },
    };
  }

  /**
   * RBAC verification: Data Analyst or Administrator.
   */
  @Get("analyst-only")
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.ADMINISTRATOR, ROLES.DATA_ANALYST)
  analystOnly(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      message: "Analyst access granted",
      user: {
        id: user.id,
        email: user.email,
        roleName: user.roleName,
      },
    };
  }

  /**
   * RBAC verification: Viewer, Data Analyst, or Administrator.
   */
  @Get("viewer-only")
  @UseGuards(BetterAuthGuard, RolesGuard)
  @Roles(ROLES.ADMINISTRATOR, ROLES.DATA_ANALYST, ROLES.VIEWER)
  viewerOnly(@CurrentUser() user: AuthenticatedUser) {
    return {
      success: true,
      message: "Viewer access granted",
      user: {
        id: user.id,
        email: user.email,
        roleName: user.roleName,
      },
    };
  }
}
