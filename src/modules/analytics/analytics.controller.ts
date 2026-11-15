import {
  Controller,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { AnalyticsService } from './analytics.service.js';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(BetterAuthGuard)
@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(
    @Inject(AnalyticsService) private readonly analyticsService: AnalyticsService,
  ) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get comprehensive platform analytics and distributions' })
  async getOverview() {
    const data = await this.analyticsService.getOverview();
    return { success: true, data };
  }

  @Get('datasets')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dataset distribution metrics' })
  async getDatasets() {
    const data = await this.analyticsService.getDatasetDistribution();
    return { success: true, data };
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get query performance analytics' })
  async getPerformance() {
    const data = await this.analyticsService.getQueryPerformance();
    return { success: true, data };
  }
}
