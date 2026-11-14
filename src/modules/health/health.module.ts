import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { RedisModule } from '../../core/redis/redis.module.js';

@Module({
  imports: [RedisModule],
  controllers: [HealthController],
})
export class HealthModule {}
