import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SavedViewsController } from './saved-views.controller.js';
import { SavedViewsService } from './saved-views.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}
