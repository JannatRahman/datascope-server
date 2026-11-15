import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { SearchHistoryController } from './search-history.controller.js';
import { SearchHistoryService } from './search-history.service.js';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SearchHistoryController],
  providers: [SearchHistoryService],
  exports: [SearchHistoryService],
})
export class SearchHistoryModule {}
