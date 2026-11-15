import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { PortalsController } from './portals.controller.js';
import { PortalsService } from './portals.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PortalsController],
  providers: [PortalsService],
  exports: [PortalsService],
})
export class PortalsModule {}
