import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';

export interface CreateNotificationDto {
  userId: string;
  type: 'export_completed' | 'export_failed' | 'saved_view_shared' | 'dataset_access_granted' | 'dataset_access_changed' | 'system';
  title: string;
  message: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  /**
   * List notifications for user
   */
  async findAll(user: AuthenticatedUser, limit = 50) {
    const query = `
      SELECT 
        id,
        user_id AS "userId",
        type,
        title,
        message,
        resource_type AS "resourceType",
        resource_id AS "resourceId",
        metadata,
        is_read AS "isRead",
        read_at AS "readAt",
        created_at AS "createdAt"
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;

    const res = await this.pool.query(query, [user.id, limit]);
    return res.rows;
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(user: AuthenticatedUser): Promise<number> {
    const query = `
      SELECT count(*)::integer AS unread
      FROM notifications
      WHERE user_id = $1 AND is_read = false;
    `;

    const res = await this.pool.query(query, [user.id]);
    return res.rows[0]?.unread ?? 0;
  }

  /**
   * Mark individual notification as read
   */
  async markAsRead(id: string, user: AuthenticatedUser) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING id, is_read AS "isRead", read_at AS "readAt";
    `;

    const res = await this.pool.query(query, [id, user.id]);
    if (res.rows.length === 0) {
      throw new NotFoundException('Notification not found');
    }
    return res.rows[0];
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(user: AuthenticatedUser) {
    const query = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false;
    `;

    await this.pool.query(query, [user.id]);
    return { success: true, message: 'All notifications marked as read' };
  }

  /**
   * Delete single notification
   */
  async delete(id: string, user: AuthenticatedUser) {
    const res = await this.pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, user.id],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Notification not found');
    }

    return { success: true, message: 'Notification deleted' };
  }

  /**
   * Create notification (internal helper used across modules)
   */
  async create(dto: CreateNotificationDto) {
    const query = `
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        resource_type,
        resource_id,
        metadata,
        is_read,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())
      RETURNING id, title, type, created_at AS "createdAt";
    `;

    const res = await this.pool.query(query, [
      dto.userId,
      dto.type,
      dto.title,
      dto.message,
      dto.resourceType ?? null,
      dto.resourceId ?? null,
      JSON.stringify(dto.metadata ?? {}),
    ]);

    return res.rows[0];
  }
}
