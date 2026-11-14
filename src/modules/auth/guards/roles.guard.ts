import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator.js";
import { ROLES, RoleType } from "../types/auth.types.js";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    // If no roles specified on endpoint or controller, permit access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Unauthenticated user attempting to access role-protected endpoint
    if (!user) {
      throw new UnauthorizedException("Unauthorized: Authentication required");
    }

    const userRole: string = user.roleName || ROLES.VIEWER;

    const hasRole = requiredRoles.includes(userRole);
    if (!hasRole) {
      throw new ForbiddenException(
        `Forbidden: Access requires one of [${requiredRoles.join(", ")}]. Current role: '${userRole}'.`
      );
    }

    return true;
  }
}
