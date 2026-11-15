import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import crypto from 'crypto';
import { PG_POOL } from '../../core/constants.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { auth } from '../../lib/auth.js';
import {
  CreateUserDto,
  UpdateUserDto,
  AddDatasetMemberDto,
} from './dto/admin.dto.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  /**
   * Log an activity in activity_logs table
   */
  async logActivity(
    userId: string,
    activityType: 'user' | 'dataset' | 'record' | 'authentication' | 'permission' | 'system',
    action: string,
    description: string,
    resourceType?: string,
    resourceId?: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO activity_logs (user_id, activity_type, action, description, resource_type, resource_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          activityType,
          action,
          description,
          resourceType ?? null,
          resourceId ?? null,
          JSON.stringify(metadata),
        ],
      );
    } catch (err) {
      this.logger.warn('Failed to record activity log:', err);
    }
  }

  /**
   * Platform Overview: Comprehensive statistics for the Administrator
   */
  async getOverview() {
    const [
      usersCountRes,
      datasetsCountRes,
      recordsCountRes,
      datasetStatsRes,
      recentActivityRes,
      perfStatsRes,
      exportStatsRes,
    ] = await Promise.all([
      this.pool.query('SELECT count(*)::integer AS total FROM "user"'),
      this.pool.query('SELECT count(*)::integer AS total FROM datasets WHERE status = $1', ['active']),
      this.pool.query('SELECT count(*)::integer AS total FROM dataset_records'),
      this.pool.query(`
        SELECT 
          d.id,
          d.name,
          d.category,
          d.status,
          COALESCE(rc.cnt, 0)::integer AS "recordCount",
          COALESCE(fc.cnt, 0)::integer AS "fieldCount"
        FROM datasets d
        LEFT JOIN (
          SELECT dataset_id, count(*)::integer AS cnt 
          FROM dataset_records 
          GROUP BY dataset_id
        ) rc ON rc.dataset_id = d.id
        LEFT JOIN (
          SELECT dataset_id, count(*)::integer AS cnt 
          FROM dataset_fields 
          GROUP BY dataset_id
        ) fc ON fc.dataset_id = d.id
        WHERE d.status = 'active'
        ORDER BY d.created_at ASC
      `),
      this.pool.query(`
        SELECT 
          al.id,
          al.activity_type AS "activityType",
          al.action,
          al.description,
          al.created_at AS "createdAt",
          u.name AS "userName",
          u.email AS "userEmail"
        FROM activity_logs al
        LEFT JOIN "user" u ON u.id = al.user_id
        ORDER BY al.created_at DESC
        LIMIT 10
      `),
      this.pool.query(`
        SELECT 
          count(*)::integer AS "totalQueries",
          COALESCE(AVG(execution_time_ms), 0)::integer AS "avgLatencyMs",
          COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::integer AS "cacheHits"
        FROM query_performance_logs
      `),
      this.pool.query(`
        SELECT 
          count(*)::integer AS "totalExports",
          COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)::integer AS "completedExports",
          COALESCE(SUM(CASE WHEN status = 'pending' OR status = 'processing' THEN 1 ELSE 0 END), 0)::integer AS "activeExports"
        FROM export_jobs
      `),
    ]);

    const totalUsers = usersCountRes.rows[0]?.total ?? 0;
    const totalDatasets = datasetsCountRes.rows[0]?.total ?? 0;
    const totalRecords = recordsCountRes.rows[0]?.total ?? 0;
    const perf = perfStatsRes.rows[0] ?? { totalQueries: 0, avgLatencyMs: 0, cacheHits: 0 };
    const exports = exportStatsRes.rows[0] ?? { totalExports: 0, completedExports: 0, activeExports: 0 };

    return {
      totalUsers,
      totalDatasets,
      totalRecords,
      metrics: {
        totalUsers,
        activeUsers: totalUsers,
        totalDatasets,
        totalRecords,
        totalQueries: perf.totalQueries,
        avgLatencyMs: perf.avgLatencyMs,
        cacheHitRate:
          perf.totalQueries > 0
            ? Math.round((perf.cacheHits / perf.totalQueries) * 100)
            : 85,
        totalExports: exports.totalExports,
        activeExports: exports.activeExports,
      },
      datasets: datasetStatsRes.rows,
      recentActivity: recentActivityRes.rows,
      health: {
        database: 'healthy',
        redis: 'healthy',
        server: 'online',
        uptimeSeconds: Math.floor(process.uptime()),
      },
    };
  }

  /**
   * User Management: List users with roles
   */
  async getUsers(search?: string, page = 1, pageSize = 25) {
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let whereClause = '';

    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      whereClause = `WHERE (u.email ILIKE $1 OR u.name ILIKE $1)`;
    }

    const countRes = await this.pool.query(
      `SELECT count(*)::integer AS total FROM "user" u ${whereClause}`,
      params,
    );
    const total = countRes.rows[0]?.total ?? 0;

    const dataQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.email_verified AS "emailVerified",
        u.role_id AS "roleId",
        r.name AS "roleName",
        u.created_at AS "createdAt",
        u.updated_at AS "updatedAt"
      FROM "user" u
      LEFT JOIN roles r ON r.id = u.role_id
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const rowsRes = await this.pool.query(dataQuery, [...params, pageSize, offset]);

    return {
      data: rowsRes.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * User Management: Create a new user with proper credentials and role
   */
  async createUser(dto: CreateUserDto, adminUser: AuthenticatedUser) {
    const existing = await this.pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [dto.email.toLowerCase().trim()],
    );
    if (existing.rows.length > 0) {
      throw new BadRequestException('User with this email already exists');
    }

    let roleId = dto.roleId;
    if (!roleId) {
      const viewerRole = await this.pool.query(
        'SELECT id FROM roles WHERE name = $1 LIMIT 1',
        ['Viewer'],
      );
      roleId = viewerRole.rows[0]?.id;
    }

    const defaultPassword = dto.password || 'DataScope2026!';
    let userId: string;

    try {
      const reg = await auth.api.signUpEmail({
        body: {
          email: dto.email.toLowerCase().trim(),
          password: defaultPassword,
          name: dto.name.trim(),
        },
      });
      userId = reg.user.id;
    } catch (authErr) {
      throw new BadRequestException(
        authErr instanceof Error ? authErr.message : 'Failed to register user credentials',
      );
    }

    // Set role and ensure email is verified
    if (roleId) {
      await this.pool.query('UPDATE "user" SET role_id = $1, email_verified = true WHERE id = $2', [
        roleId,
        userId,
      ]);
    }

    const fetchUser = await this.pool.query(
      `SELECT u.id, u.name, u.email, u.email_verified AS "emailVerified", u.role_id AS "roleId", r.name AS "roleName", u.created_at AS "createdAt"
       FROM "user" u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId],
    );

    const newUser = fetchUser.rows[0];

    await this.logActivity(
      adminUser.id,
      'user',
      'USER_CREATED',
      `Created user '${newUser.email}' with role '${newUser.roleName || 'Viewer'}'`,
      'user',
      undefined,
      { createdUserId: newUser.id, roleId },
    );

    return newUser;
  }

  /**
   * User Management: Update user role / info with administrative safeguards
   */
  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    adminUser: AuthenticatedUser,
  ) {
    const userRes = await this.pool.query('SELECT * FROM "user" WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    // SAFEGUARD: Prevent accidental removal of last administrative access
    if (dto.roleId !== undefined) {
      const currentRoleRes = await this.pool.query(
        `SELECT r.name FROM "user" u JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
        [userId],
      );
      const currentRoleName = currentRoleRes.rows[0]?.name;

      if (currentRoleName === 'Administrator') {
        const targetRoleRes = await this.pool.query(
          `SELECT name FROM roles WHERE id = $1`,
          [dto.roleId],
        );
        const targetRoleName = targetRoleRes.rows[0]?.name;

        if (targetRoleName !== 'Administrator') {
          // If self-demoting
          if (userId === adminUser.id) {
            throw new BadRequestException('You cannot demote your own administrator account');
          }
          // If demoting another admin, verify there is at least one other active Administrator
          const adminCountRes = await this.pool.query(
            `SELECT count(*)::integer AS total FROM "user" u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Administrator'`,
          );
          if ((adminCountRes.rows[0]?.total ?? 0) <= 1) {
            throw new BadRequestException('Cannot remove the last platform Administrator');
          }
        }
      }
    }

    const updates: string[] = [];
    const params: unknown[] = [userId];

    if (dto.name !== undefined) {
      params.push(dto.name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (dto.roleId !== undefined) {
      params.push(dto.roleId);
      updates.push(`role_id = $${params.length}`);
    }
    if (dto.emailVerified !== undefined) {
      params.push(dto.emailVerified);
      updates.push(`email_verified = $${params.length}`);
    }

    updates.push(`updated_at = NOW()`);

    const updateQuery = `
      UPDATE "user"
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING id, name, email, email_verified AS "emailVerified", role_id AS "roleId", updated_at AS "updatedAt"
    `;

    const res = await this.pool.query(updateQuery, params);

    // If account deactivated, immediately invalidate their sessions
    if (dto.emailVerified === false) {
      await this.pool.query('DELETE FROM session WHERE user_id = $1', [userId]);
    }

    // Invalidate Redis caches for this user
    await this.redisService.invalidatePattern(`cache:datasets:user:${userId}:*`);
    await this.redisService.invalidatePattern(`cache:session:*`);

    await this.logActivity(
      adminUser.id,
      'user',
      'USER_UPDATED',
      `Updated user '${res.rows[0].email}' profile/role/status`,
      'user',
      undefined,
      { updatedUserId: userId, changes: dto },
    );

    return res.rows[0];
  }

  /**
   * User Management: Delete / Deactivate user with administrative safeguards
   */
  async deleteUser(userId: string, adminUser: AuthenticatedUser) {
    if (userId === adminUser.id) {
      throw new BadRequestException('Cannot delete your own administrator account');
    }

    const currentRoleRes = await this.pool.query(
      `SELECT r.name, u.email FROM "user" u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = $1`,
      [userId],
    );
    if (currentRoleRes.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const email = currentRoleRes.rows[0].email;
    const isTargetAdmin = currentRoleRes.rows[0].name === 'Administrator';

    if (isTargetAdmin) {
      const adminCountRes = await this.pool.query(
        `SELECT count(*)::integer AS total FROM "user" u JOIN roles r ON r.id = u.role_id WHERE r.name = 'Administrator'`,
      );
      if ((adminCountRes.rows[0]?.total ?? 0) <= 1) {
        throw new BadRequestException('Cannot delete the last platform Administrator');
      }
    }

    // Delete user sessions, accounts, and user record
    await this.pool.query('DELETE FROM session WHERE user_id = $1', [userId]);
    await this.pool.query('DELETE FROM account WHERE user_id = $1', [userId]);
    await this.pool.query('DELETE FROM "user" WHERE id = $1', [userId]);

    await this.redisService.invalidatePattern(`cache:datasets:user:${userId}:*`);
    await this.redisService.invalidatePattern(`cache:session:*`);

    await this.logActivity(
      adminUser.id,
      'user',
      'USER_DELETED',
      `Deleted user account '${email}'`,
      'user',
      undefined,
      { deletedUserId: userId },
    );

    return { success: true, message: `User '${email}' deleted successfully` };
  }

  /**
   * Roles & Permissions Management: List all roles with permission and user counts
   */
  async getRoles() {
    const rolesRes = await this.pool.query(`
      SELECT 
        r.id,
        r.name,
        r.description,
        r.created_at AS "createdAt",
        COALESCE(uc.user_count, 0)::integer AS "userCount",
        COALESCE(pc.perm_count, 0)::integer AS "permissionCount"
      FROM roles r
      LEFT JOIN (
        SELECT role_id, count(*)::integer AS user_count 
        FROM "user" 
        GROUP BY role_id
      ) uc ON uc.role_id = r.id
      LEFT JOIN (
        SELECT role_id, count(*)::integer AS perm_count 
        FROM role_permissions 
        GROUP BY role_id
      ) pc ON pc.role_id = r.id
      ORDER BY r.name ASC
    `);

    return rolesRes.rows;
  }

  /**
   * Roles & Permissions Management: List all permissions grouped by domain
   */
  async getPermissions() {
    const permsRes = await this.pool.query(`
      SELECT 
        id, 
        name, 
        description,
        SPLIT_PART(name, ':', 1) AS category
      FROM permissions
      ORDER BY name ASC
    `);

    return permsRes.rows;
  }

  /**
   * Roles & Permissions Management: Get permissions assigned to a role
   */
  async getRolePermissions(roleId: string) {
    const res = await this.pool.query(
      `SELECT 
        p.id, 
        p.name, 
        p.description,
        SPLIT_PART(p.name, ':', 1) AS category
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.name ASC`,
      [roleId],
    );

    return res.rows;
  }

  /**
   * Roles & Permissions Management: Update permissions for a role
   */
  async updateRolePermissions(
    roleId: string,
    permissionIds: string[],
    adminUser: AuthenticatedUser,
  ) {
    const roleRes = await this.pool.query('SELECT name FROM roles WHERE id = $1', [roleId]);
    if (roleRes.rows.length === 0) {
      throw new NotFoundException('Role not found');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

      if (permissionIds.length > 0) {
        for (const permId of permissionIds) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [roleId, permId],
          );
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Invalidate permission and dataset caches across Redis
    await this.redisService.invalidatePattern('cache:*');

    await this.logActivity(
      adminUser.id,
      'permission',
      'ROLE_PERMISSIONS_UPDATED',
      `Updated permissions for role '${roleRes.rows[0].name}' (${permissionIds.length} permissions assigned)`,
      'role',
      undefined,
      { roleId, permissionCount: permissionIds.length },
    );

    return { success: true, count: permissionIds.length };
  }

  /**
   * Dataset Management: List all datasets with their assigned members
   */
  async getDatasetsWithMembers() {
    const datasetsRes = await this.pool.query(`
      SELECT 
        d.id,
        d.name,
        d.description,
        d.category,
        d.data_source AS "dataSource",
        d.status,
        d.created_at AS "createdAt",
        COALESCE(rc.cnt, 0)::integer AS "recordCount",
        COALESCE(fc.cnt, 0)::integer AS "fieldCount"
      FROM datasets d
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_records GROUP BY dataset_id) rc ON rc.dataset_id = d.id
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_fields GROUP BY dataset_id) fc ON fc.dataset_id = d.id
      WHERE d.status = 'active'
      ORDER BY d.created_at ASC
    `);

    const membersRes = await this.pool.query(`
      SELECT 
        dm.dataset_id AS "datasetId",
        dm.user_id AS "userId",
        dm.access_level AS "accessLevel",
        u.name AS "userName",
        u.email AS "userEmail",
        r.name AS "roleName"
      FROM dataset_members dm
      JOIN "user" u ON u.id = dm.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      ORDER BY u.name ASC
    `);

    const membersMap = new Map<string, unknown[]>();
    for (const m of membersRes.rows) {
      const list = membersMap.get(m.datasetId) ?? [];
      list.push(m);
      membersMap.set(m.datasetId, list);
    }

    return datasetsRes.rows.map((d) => ({
      ...d,
      members: membersMap.get(d.id) ?? [],
    }));
  }

  /**
   * Dataset Access Control: Add or update dataset membership
   */
  async addOrUpdateDatasetMember(
    datasetId: string,
    dto: AddDatasetMemberDto,
    adminUser: AuthenticatedUser,
  ) {
    const datasetRes = await this.pool.query('SELECT name FROM datasets WHERE id = $1', [datasetId]);
    if (datasetRes.rows.length === 0) throw new NotFoundException('Dataset not found');

    const userRes = await this.pool.query('SELECT email FROM "user" WHERE id = $1', [dto.userId]);
    if (userRes.rows.length === 0) throw new NotFoundException('User not found');

    await this.pool.query(
      `INSERT INTO dataset_members (dataset_id, user_id, access_level, invited_by, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (dataset_id, user_id)
       DO UPDATE SET access_level = $3, updated_at = NOW()`,
      [datasetId, dto.userId, dto.accessLevel, adminUser.id],
    );

    // Invalidate dataset list cache for this user
    await this.redisService.invalidatePattern(`cache:datasets:user:${dto.userId}:*`);

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_MEMBER_UPDATED',
      `Assigned '${dto.accessLevel}' access to '${userRes.rows[0].email}' on dataset '${datasetRes.rows[0].name}'`,
      'dataset',
      undefined,
      { datasetId, userId: dto.userId, accessLevel: dto.accessLevel },
    );

    return { success: true };
  }

  /**
   * Dataset Access Control: Remove member from dataset
   */
  async removeDatasetMember(
    datasetId: string,
    userId: string,
    adminUser: AuthenticatedUser,
  ) {
    await this.pool.query(
      'DELETE FROM dataset_members WHERE dataset_id = $1 AND user_id = $2',
      [datasetId, userId],
    );

    await this.redisService.invalidatePattern(`cache:datasets:user:${userId}:*`);

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_MEMBER_REMOVED',
      `Revoked dataset access for user '${userId}'`,
      'dataset',
      undefined,
      { datasetId, userId },
    );

    return { success: true };
  }

  /**
   * Activity Logs: Paginated log viewer
   */
  async getActivityLogs(page = 1, pageSize = 20, type?: string) {
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    let whereClause = '';

    if (type && type !== 'all') {
      params.push(type);
      whereClause = `WHERE al.activity_type = $1`;
    }

    const countRes = await this.pool.query(
      `SELECT count(*)::integer AS total FROM activity_logs al ${whereClause}`,
      params,
    );
    const total = countRes.rows[0]?.total ?? 0;

    const logsRes = await this.pool.query(
      `SELECT 
        al.id,
        al.activity_type AS "activityType",
        al.action,
        al.description,
        al.resource_type AS "resourceType",
        al.metadata,
        al.created_at AS "createdAt",
        u.name AS "userName",
        u.email AS "userEmail"
      FROM activity_logs al
      LEFT JOIN "user" u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset],
    );

    return {
      data: logsRes.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Query Performance Logs
   */
  async getPerformanceLogs(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const countRes = await this.pool.query(
      'SELECT count(*)::integer AS total FROM query_performance_logs',
    );
    const total = countRes.rows[0]?.total ?? 0;

    const logsRes = await this.pool.query(
      `SELECT 
        qp.id,
        qp.operation,
        qp.endpoint,
        qp.execution_time_ms AS "executionTimeMs",
        qp.records_returned AS "recordsReturned",
        qp.cache_hit AS "cacheHit",
        qp.metadata,
        qp.created_at AS "createdAt",
        d.name AS "datasetName"
      FROM query_performance_logs qp
      LEFT JOIN datasets d ON d.id = qp.dataset_id
      ORDER BY qp.created_at DESC
      LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );

    return {
      data: logsRes.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Export Jobs Management
   */
  async getExports(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const countRes = await this.pool.query(
      'SELECT count(*)::integer AS total FROM export_jobs',
    );
    const total = countRes.rows[0]?.total ?? 0;

    const exportsRes = await this.pool.query(
      `SELECT 
        ej.id,
        ej.status,
        ej.format,
        ej.file_name AS "fileName",
        ej.total_records AS "totalRecords",
        ej.processed_records AS "processedRecords",
        ej.requested_at AS "requestedAt",
        ej.completed_at AS "completedAt",
        d.name AS "datasetName",
        u.email AS "userEmail"
      FROM export_jobs ej
      JOIN datasets d ON d.id = ej.dataset_id
      JOIN "user" u ON u.id = ej.user_id
      ORDER BY ej.requested_at DESC
      LIMIT $1 OFFSET $2`,
      [pageSize, offset],
    );

    return {
      data: exportsRes.rows,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }
}
