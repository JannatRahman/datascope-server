import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
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

  @Get('datasets/:datasetId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get analytics for a specific authorized dataset' })
  async getDatasetAnalytics(
    @Param('datasetId') datasetId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.analyticsService.getDatasetAnalytics(datasetId, user);
    return { success: true, data };
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get query performance analytics' })
  async getPerformance() {
    const data = await this.analyticsService.getQueryPerformance();
    return { success: true, data };
  }

  @Get('growth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get dataset, record and user growth trends' })
  async getGrowth() {
    const data = await this.analyticsService.getGrowthTrends();
    return { success: true, data };
  }

  @Get('filters')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get most frequently applied search filters' })
  async getFilters() {
    const data = await this.analyticsService.getFrequentFilters();
    return { success: true, data };
  }
}
