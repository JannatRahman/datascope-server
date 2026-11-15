import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [DatabaseModule, RedisModule, AuthModule, DatasetsModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
