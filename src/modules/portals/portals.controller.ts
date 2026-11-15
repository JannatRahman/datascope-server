import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';
import { PortalsService } from './portals.service.js';

@ApiTags('Dashboards')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1')
export class PortalsController {
  constructor(
    @Inject(PortalsService) private readonly portalsService: PortalsService,
  ) {}

  @Get('analyst/overview')
  @UseGuards(RolesGuard)
  @Roles(ROLES.ADMINISTRATOR, ROLES.DATA_ANALYST)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Analyst dashboard metrics, recent searches, and saved views' })
  @ApiResponse({ status: 200, description: 'Analyst overview data' })
  @ApiResponse({ status: 403, description: 'Forbidden: Requires Data Analyst or Administrator role' })
  async getAnalystOverview(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.portalsService.getAnalystOverview(user);
    return { success: true, data };
  }

  @Get('viewer/overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Viewer dashboard assigned datasets and shared views' })
  @ApiResponse({ status: 200, description: 'Viewer overview data' })
  async getViewerOverview(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.portalsService.getViewerOverview(user);
    return { success: true, data };
  }
}
