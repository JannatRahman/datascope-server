import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';

export interface UserPreferencesDto {
  theme?: string;
  tableDensity?: string;
  defaultPageSize?: number;
  sidebarCollapsed?: boolean;
  dashboardLayout?: Record<string, unknown>;
  additionalPreferences?: Record<string, unknown>;
}

@Injectable()
export class PreferencesService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async getPreferences(userId: string) {
    const res = await this.pool.query(
      `SELECT 
        theme,
        table_density AS "tableDensity",
        default_page_size AS "defaultPageSize",
        sidebar_collapsed AS "sidebarCollapsed",
        dashboard_layout AS "dashboardLayout",
        additional_preferences AS "additionalPreferences"
       FROM user_preferences 
       WHERE user_id = $1`,
      [userId],
    );

    if (res.rows.length === 0) {
      return {
        theme: 'system',
        tableDensity: 'comfortable',
        defaultPageSize: 25,
        sidebarCollapsed: false,
        dashboardLayout: {},
        additionalPreferences: {},
      };
    }

    return res.rows[0];
  }

  async updatePreferences(userId: string, dto: UserPreferencesDto) {
    const res = await this.pool.query(
      `INSERT INTO user_preferences (
        user_id, theme, table_density, default_page_size, sidebar_collapsed, dashboard_layout, additional_preferences, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        theme = COALESCE($2, user_preferences.theme),
        table_density = COALESCE($3, user_preferences.table_density),
        default_page_size = COALESCE($4, user_preferences.default_page_size),
        sidebar_collapsed = COALESCE($5, user_preferences.sidebar_collapsed),
        dashboard_layout = COALESCE($6, user_preferences.dashboard_layout),
        additional_preferences = COALESCE($7, user_preferences.additional_preferences),
        updated_at = NOW()
      RETURNING 
        theme,
        table_density AS "tableDensity",
        default_page_size AS "defaultPageSize",
        sidebar_collapsed AS "sidebarCollapsed",
        dashboard_layout AS "dashboardLayout",
        additional_preferences AS "additionalPreferences"`,
      [
        userId,
        dto.theme ?? 'system',
        dto.tableDensity ?? 'comfortable',
        dto.defaultPageSize ?? 25,
        dto.sidebarCollapsed ?? false,
        JSON.stringify(dto.dashboardLayout ?? {}),
        JSON.stringify(dto.additionalPreferences ?? {}),
      ],
    );

    return res.rows[0];
  }
}
