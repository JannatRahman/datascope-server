import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { UpdateSystemSettingsDto } from '../admin/dto/admin.dto.js';

export interface PlatformSettings {
  platformName: string;
  supportEmail: string;
  timezone: string;
  dateFormat: string;
  defaultPageSize: number;
  maxPageSize: number;
  cacheEnabled: boolean;
  cacheTtlSeconds: number;
  searchMinLength: number;
  searchMaxResults: number;
  allowUserRegistration: boolean;
  maintenanceMode: boolean;
  sessionTimeoutMinutes: number;
}

const DEFAULT_SETTINGS: PlatformSettings = {
  platformName: 'DataScope',
  supportEmail: 'support@datascope.local',
  timezone: 'UTC',
  dateFormat: 'YYYY-MM-DD',
  defaultPageSize: 25,
  maxPageSize: 100,
  cacheEnabled: true,
  cacheTtlSeconds: 60,
  searchMinLength: 2,
  searchMaxResults: 100,
  allowUserRegistration: true,
  maintenanceMode: false,
  sessionTimeoutMinutes: 1440,
};

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureTable();
    } catch (err) {
      this.logger.warn('Unable to initialise platform settings table:', err);
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    await this.ensureTable();

    const res = await this.pool.query(
      `SELECT value FROM platform_settings WHERE key = 'platform'`,
    );

    const stored = (res.rows[0]?.value ?? {}) as Partial<PlatformSettings>;
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  async updateSettings(
    dto: UpdateSystemSettingsDto,
    adminUser: AuthenticatedUser,
  ): Promise<PlatformSettings> {
    const current = await this.getSettings();
    const merged: PlatformSettings = { ...current, ...dto };

    this.validateSettings(merged);

    await this.pool.query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES ('platform', $1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(merged), adminUser.id],
    );

    await this.redisService.invalidatePattern('cache:settings:*');

    await this.logActivity(
      adminUser.id,
      'system',
      'SETTINGS_UPDATED',
      'Updated platform configuration settings',
      { changedKeys: Object.keys(dto) },
    );

    return merged;
  }

  async resetSettings(adminUser: AuthenticatedUser): Promise<PlatformSettings> {
    await this.ensureTable();

    await this.pool.query(
      `INSERT INTO platform_settings (key, value, updated_by, updated_at)
       VALUES ('platform', $1, $2, NOW())
       ON CONFLICT (key)
       DO UPDATE SET value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(DEFAULT_SETTINGS), adminUser.id],
    );

    await this.redisService.invalidatePattern('cache:settings:*');

    await this.logActivity(
      adminUser.id,
      'system',
      'SETTINGS_RESET',
      'Reset platform configuration settings to defaults',
      {},
    );

    return DEFAULT_SETTINGS;
  }

  async clearCache(adminUser: AuthenticatedUser): Promise<{ success: boolean }> {
    await this.redisService.invalidatePattern('cache:*');

    await this.logActivity(
      adminUser.id,
      'system',
      'CACHE_CLEARED',
      'Cleared all distributed cache entries',
      {},
    );

    return { success: true };
  }

  private validateSettings(settings: PlatformSettings): void {
    if (!settings.platformName?.trim()) {
      throw new BadRequestException('Platform name is required');
    }

    if (
      !Number.isFinite(settings.defaultPageSize) ||
      settings.defaultPageSize < 1 ||
      settings.defaultPageSize > 1000
    ) {
      throw new BadRequestException('Default page size must be between 1 and 1000');
    }

    if (
      !Number.isFinite(settings.maxPageSize) ||
      settings.maxPageSize < settings.defaultPageSize ||
      settings.maxPageSize > 5000
    ) {
      throw new BadRequestException(
        'Max page size must be at least the default page size and at most 5000',
      );
    }

    if (!Number.isFinite(settings.cacheTtlSeconds) || settings.cacheTtlSeconds < 0) {
      throw new BadRequestException('Cache TTL must be zero or greater');
    }

    if (!Number.isFinite(settings.searchMinLength) || settings.searchMinLength < 1) {
      throw new BadRequestException('Search minimum length must be at least 1');
    }

    if (!Number.isFinite(settings.searchMaxResults) || settings.searchMaxResults < 1) {
      throw new BadRequestException('Search maximum results must be at least 1');
    }

    if (
      !Number.isFinite(settings.sessionTimeoutMinutes) ||
      settings.sessionTimeoutMinutes < 5
    ) {
      throw new BadRequestException('Session timeout must be at least 5 minutes');
    }
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        key text PRIMARY KEY,
        value jsonb NOT NULL DEFAULT '{}'::jsonb,
        updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await this.pool.query(
      `INSERT INTO platform_settings (key, value)
       VALUES ('platform', $1)
       ON CONFLICT (key) DO NOTHING`,
      [JSON.stringify(DEFAULT_SETTINGS)],
    );
  }

  private async logActivity(
    userId: string,
    activityType: 'system',
    action: string,
    description: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO activity_logs (user_id, activity_type, action, description, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, activityType, action, description, JSON.stringify(metadata)],
      );
    } catch (err) {
      this.logger.warn('Failed to record settings activity:', err);
    }
  }
}
