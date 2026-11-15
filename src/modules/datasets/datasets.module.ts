import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatasetsController } from './datasets.controller.js';
import { DatasetsService } from './datasets.service.js';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule],
  controllers: [DatasetsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
