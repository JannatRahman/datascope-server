import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule, DatasetsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
