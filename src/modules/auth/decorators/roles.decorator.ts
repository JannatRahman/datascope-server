import { SetMetadata, CustomDecorator } from "@nestjs/common";
import { RoleType } from "../types/auth.types.js";

export const ROLES_KEY = "roles";

/**
 * Decorator to declare required RBAC roles for a route or controller.
 * Usage:
 *   @Roles('Administrator')
 *   @Roles('Administrator', 'Data Analyst')
 */
export const Roles = (...roles: RoleType[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
