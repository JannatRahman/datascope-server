import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { RecordsController } from './records.controller.js';
import { RecordsService } from './records.service.js';

@Module({
  imports: [DatabaseModule, DatasetsModule, AuthModule],
  controllers: [RecordsController],
  providers: [RecordsService],
  exports: [RecordsService],
})
export class RecordsModule {}
