import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { AuthenticatedUser } from "../types/auth.types.js";

/**
 * Parameter decorator to extract the authenticated user from the request.
 * Usage:
 *   getProfile(@CurrentUser() user: AuthenticatedUser)
 *   getId(@CurrentUser('id') userId: string)
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: AuthenticatedUser | undefined = request.user;

    if (!user) {
      return undefined;
    }

    if (data) {
      return user[data];
    }

    return user;
  }
);
