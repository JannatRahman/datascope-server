import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SystemSettingsController } from './system-settings.controller.js';
import { SystemSettingsService } from './system-settings.service.js';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
