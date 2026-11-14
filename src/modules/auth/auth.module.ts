import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { BetterAuthGuard } from "./guards/better-auth.guard.js";
import { RolesGuard } from "./guards/roles.guard.js";

@Module({
  controllers: [AuthController],
  providers: [AuthService, BetterAuthGuard, RolesGuard],
  exports: [AuthService, BetterAuthGuard, RolesGuard],
})
export class AuthModule {}
