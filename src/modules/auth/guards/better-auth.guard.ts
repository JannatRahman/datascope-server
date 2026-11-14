import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import { AuthService } from "../auth.service.js";

@Injectable()
export class BetterAuthGuard implements CanActivate {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    const rawToken = this.authService.extractSessionToken(request);
    const result = await this.authService.validateSession(
      request.headers,
      rawToken
    );

    if (!result || !result.user || !result.session) {
      throw new UnauthorizedException(
        "Unauthorized: Invalid or expired session"
      );
    }

    request.user = result.user;
    request.session = result.session;

    return true;
  }
}
