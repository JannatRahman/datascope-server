import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './core/database/database.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DatasetsModule } from './modules/datasets/datasets.module.js';
import { RecordsModule } from './modules/records/records.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { PortalsModule } from './modules/portals/portals.module.js';
import { SavedViewsModule } from './modules/saved-views/saved-views.module.js';
import { PreferencesModule } from './modules/preferences/preferences.module.js';
import { ExportsModule } from './modules/exports/exports.module.js';
import { SearchHistoryModule } from './modules/search-history/search-history.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { AnalyticsModule } from './modules/analytics/analytics.module.js';
import { SystemSettingsModule } from './modules/system-settings/system-settings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    RedisModule,
    HealthModule,
    AuthModule,
    DatasetsModule,
    RecordsModule,
    AdminModule,
    PortalsModule,
    SavedViewsModule,
    PreferencesModule,
    ExportsModule,
    SearchHistoryModule,
    NotificationsModule,
    AnalyticsModule,
    SystemSettingsModule,
  ],
})
export class AppModule {}
