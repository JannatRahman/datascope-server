import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { DatasetsModule } from '../datasets/datasets.module.js';
import { RecordsModule } from '../records/records.module.js';
import { ExportsController } from './exports.controller.js';
import { ExportsService } from './exports.service.js';

@Module({
  imports: [DatabaseModule, DatasetsModule, RecordsModule, AuthModule],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
