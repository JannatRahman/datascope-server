import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';

export interface CreateSavedViewDto {
  name: string;
  description?: string;
  datasetId: string;
  searchQuery?: string;
  filters?: Record<string, unknown> | unknown[];
  sortConfig?: Record<string, unknown> | unknown[];
  visibleColumns?: string[];
  isShared?: boolean;
}

export interface UpdateSavedViewDto {
  name?: string;
  description?: string;
  searchQuery?: string;
  filters?: Record<string, unknown> | unknown[];
  sortConfig?: Record<string, unknown> | unknown[];
  visibleColumns?: string[];
  isShared?: boolean;
}

@Injectable()
export class SavedViewsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  async findAll(user: AuthenticatedUser, datasetId?: string) {
    const params: unknown[] = [user.id];
    let datasetFilter = '';
    if (datasetId) {
      params.push(datasetId);
      datasetFilter = `AND sv.dataset_id = $2`;
    }

    const query = `
      SELECT DISTINCT
        sv.id,
        sv.name,
        sv.description,
        sv.user_id AS "userId",
        sv.dataset_id AS "datasetId",
        sv.search_query AS "searchQuery",
        sv.filters,
        sv.sort_config AS "sortConfig",
        sv.visible_columns AS "visibleColumns",
        sv.is_shared AS "isShared",
        sv.created_at AS "createdAt",
        sv.updated_at AS "updatedAt",
        d.name AS "datasetName",
        u.name AS "creatorName",
        CASE WHEN sv.user_id = $1 THEN true ELSE false END AS "isOwner"
      FROM saved_views sv
      JOIN datasets d ON d.id = sv.dataset_id
      JOIN "user" u ON u.id = sv.user_id
      LEFT JOIN saved_view_shares svs ON svs.saved_view_id = sv.id
      WHERE (
        sv.user_id = $1 
        OR sv.is_shared = true 
        OR svs.shared_with_user_id = $1
        OR $1 IN (SELECT id FROM "user" WHERE role_id = (SELECT id FROM roles WHERE name = '${ROLES.ADMINISTRATOR}'))
      )
        ${datasetFilter}
      ORDER BY sv.updated_at DESC;
    `;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const res = await this.pool.query(
      `SELECT sv.*, d.name AS dataset_name 
       FROM saved_views sv
       JOIN datasets d ON d.id = sv.dataset_id
       LEFT JOIN saved_view_shares svs ON svs.saved_view_id = sv.id
       WHERE sv.id = $1 AND (
         sv.user_id = $2 
         OR sv.is_shared = true 
         OR svs.shared_with_user_id = $2 
         OR $3 = '${ROLES.ADMINISTRATOR}'
       )`,
      [id, user.id, user.roleName],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Saved view not found or not accessible');
    }

    return res.rows[0];
  }

  async create(user: AuthenticatedUser, dto: CreateSavedViewDto) {
    const res = await this.pool.query(
      `INSERT INTO saved_views (name, description, user_id, dataset_id, search_query, filters, sort_config, visible_columns, is_shared, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
       RETURNING id, name, description, dataset_id AS "datasetId", is_shared AS "isShared", created_at AS "createdAt"`,
      [
        dto.name.trim(),
        dto.description ?? null,
        user.id,
        dto.datasetId,
        dto.searchQuery ?? '',
        JSON.stringify(dto.filters ?? []),
        JSON.stringify(dto.sortConfig ?? []),
        JSON.stringify(dto.visibleColumns ?? []),
        dto.isShared ?? false,
      ],
    );

    // Activity log
    await this.logActivity(user.id, 'user', 'create_saved_view', `Created saved view: ${dto.name}`, 'saved_view', res.rows[0].id);

    return res.rows[0];
  }

  async update(id: string, user: AuthenticatedUser, dto: UpdateSavedViewDto) {
    const existing = await this.pool.query('SELECT user_id, name FROM saved_views WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundException('Saved view not found');

    if (existing.rows[0].user_id !== user.id && user.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('Only the view owner or administrator can modify this saved view');
    }

    const updates: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [id];

    if (dto.name !== undefined) {
      params.push(dto.name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (dto.description !== undefined) {
      params.push(dto.description);
      updates.push(`description = $${params.length}`);
    }
    if (dto.searchQuery !== undefined) {
      params.push(dto.searchQuery);
      updates.push(`search_query = $${params.length}`);
    }
    if (dto.filters !== undefined) {
      params.push(JSON.stringify(dto.filters));
      updates.push(`filters = $${params.length}`);
    }
    if (dto.sortConfig !== undefined) {
      params.push(JSON.stringify(dto.sortConfig));
      updates.push(`sort_config = $${params.length}`);
    }
    if (dto.visibleColumns !== undefined) {
      params.push(JSON.stringify(dto.visibleColumns));
      updates.push(`visible_columns = $${params.length}`);
    }
    if (dto.isShared !== undefined) {
      params.push(dto.isShared);
      updates.push(`is_shared = $${params.length}`);
    }

    const query = `
      UPDATE saved_views 
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, name, description, dataset_id AS "datasetId", is_shared AS "isShared", updated_at AS "updatedAt"
    `;

    const res = await this.pool.query(query, params);
    await this.logActivity(user.id, 'user', 'update_saved_view', `Updated saved view: ${res.rows[0].name}`, 'saved_view', id);
    return res.rows[0];
  }

  async delete(id: string, user: AuthenticatedUser) {
    const existing = await this.pool.query('SELECT user_id, name FROM saved_views WHERE id = $1', [id]);
    if (existing.rows.length === 0) throw new NotFoundException('Saved view not found');

    if (existing.rows[0].user_id !== user.id && user.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('Only the view owner or administrator can delete this saved view');
    }

    await this.pool.query('DELETE FROM saved_views WHERE id = $1', [id]);
    await this.logActivity(user.id, 'user', 'delete_saved_view', `Deleted saved view: ${existing.rows[0].name}`, 'saved_view', id);
    return { success: true };
  }

  /**
   * Share saved view with a specific user
   */
  async shareWithUser(savedViewId: string, targetUserId: string, currentUser: AuthenticatedUser) {
    const viewRes = await this.pool.query('SELECT user_id, name FROM saved_views WHERE id = $1', [savedViewId]);
    if (viewRes.rows.length === 0) throw new NotFoundException('Saved view not found');

    if (viewRes.rows[0].user_id !== currentUser.id && currentUser.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('Only the view owner can share this saved view');
    }

    const userRes = await this.pool.query('SELECT id, name FROM "user" WHERE id = $1', [targetUserId]);
    if (userRes.rows.length === 0) throw new NotFoundException('Target user not found');

    await this.pool.query(
      `INSERT INTO saved_view_shares (saved_view_id, shared_with_user_id, shared_by_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (saved_view_id, shared_with_user_id) DO NOTHING`,
      [savedViewId, targetUserId, currentUser.id],
    );

    // Send notification to target user
    await this.createNotification(
      targetUserId,
      'saved_view_shared',
      'Saved View Shared',
      `${currentUser.name} shared the saved view "${viewRes.rows[0].name}" with you.`,
      'saved_view',
      savedViewId,
    );

    await this.logActivity(
      currentUser.id,
      'permission',
      'share_saved_view',
      `Shared saved view "${viewRes.rows[0].name}" with ${userRes.rows[0].name}`,
      'saved_view',
      savedViewId,
    );

    return { success: true, message: 'View shared successfully' };
  }

  /**
   * Get list of users a view is shared with
   */
  async getShares(savedViewId: string, currentUser: AuthenticatedUser) {
    const viewRes = await this.pool.query('SELECT user_id FROM saved_views WHERE id = $1', [savedViewId]);
    if (viewRes.rows.length === 0) throw new NotFoundException('Saved view not found');

    if (viewRes.rows[0].user_id !== currentUser.id && currentUser.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('Only the view owner or administrator can view share details');
    }

    const query = `
      SELECT 
        svs.saved_view_id AS "savedViewId",
        svs.shared_with_user_id AS "userId",
        u.name AS "userName",
        u.email AS "userEmail",
        svs.created_at AS "sharedAt"
      FROM saved_view_shares svs
      JOIN "user" u ON u.id = svs.shared_with_user_id
      WHERE svs.saved_view_id = $1
      ORDER BY svs.created_at DESC;
    `;

    const res = await this.pool.query(query, [savedViewId]);
    return res.rows;
  }

  /**
   * Revoke view sharing from a user
   */
  async removeShare(savedViewId: string, targetUserId: string, currentUser: AuthenticatedUser) {
    const viewRes = await this.pool.query('SELECT user_id, name FROM saved_views WHERE id = $1', [savedViewId]);
    if (viewRes.rows.length === 0) throw new NotFoundException('Saved view not found');

    if (viewRes.rows[0].user_id !== currentUser.id && currentUser.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('Only the view owner or administrator can revoke share access');
    }

    await this.pool.query(
      'DELETE FROM saved_view_shares WHERE saved_view_id = $1 AND shared_with_user_id = $2',
      [savedViewId, targetUserId],
    );

    return { success: true, message: 'Share access revoked successfully' };
  }

  private async createNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    resourceType?: string,
    resourceId?: string,
  ) {
    try {
      await this.pool.query(
        `INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, type, title, message, resourceType ?? null, resourceId ?? null],
      );
    } catch {}
  }

  private async logActivity(
    userId: string,
    activityType: string,
    action: string,
    description: string,
    resourceType?: string,
    resourceId?: string,
  ) {
    try {
      await this.pool.query(
        `INSERT INTO activity_logs (user_id, activity_type, action, description, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, activityType, action, description, resourceType ?? null, resourceId ?? null],
      );
    } catch {}
  }
}
