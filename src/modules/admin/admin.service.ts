import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import crypto from 'crypto';
import { PG_POOL } from '../../core/constants.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { auth } from '../../lib/auth.js';
import {
  CreateUserDto,
  UpdateUserDto,
  AddDatasetMemberDto,
  CreateDatasetDto,
  UpdateDatasetDto,
  CreateDatasetFieldDto,
  UpdateDatasetFieldDto,
  GenerateDatasetRecordsDto,
  ImportDatasetRecordsDto,
  UpdateSharedViewDto,
  DatasetFieldDataType,
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
      activeUsersRes,
      datasetsCountRes,
      recordsCountRes,
      datasetStatsRes,
      recentActivityRes,
      perfStatsRes,
      exportStatsRes,
      growthRes,
      searchStatsRes,
      topFiltersRes,
    ] = await Promise.all([
      this.pool.query('SELECT count(*)::integer AS total FROM "user"'),
      this.pool.query(
        `SELECT count(DISTINCT user_id)::integer AS total FROM session WHERE expires_at > NOW()`,
      ),
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
      this.pool.query(`
        WITH months AS (
          SELECT generate_series(
            date_trunc('month', NOW()) - INTERVAL '5 months',
            date_trunc('month', NOW()),
            INTERVAL '1 month'
          ) AS month
        )
        SELECT
          to_char(m.month, 'YYYY-MM') AS month,
          (SELECT count(*)::integer FROM "user" u WHERE date_trunc('month', u.created_at) = m.month) AS users,
          (SELECT count(*)::integer FROM datasets d WHERE date_trunc('month', d.created_at) = m.month) AS datasets,
          (SELECT count(*)::integer FROM dataset_records dr WHERE date_trunc('month', dr.created_at) = m.month) AS records
        FROM months m
        ORDER BY m.month ASC
      `),
      this.pool.query(`
        SELECT
          count(*)::integer AS "totalSearches",
          count(*) FILTER (WHERE searched_at >= NOW() - INTERVAL '7 days')::integer AS "searchesLast7Days",
          COALESCE(AVG(execution_time_ms), 0)::integer AS "avgLatencyMs"
        FROM search_history
      `),
      this.pool.query(`
        SELECT key, value, count(*)::integer AS count
        FROM search_history sh,
             LATERAL jsonb_each_text(sh.filters)
        WHERE jsonb_typeof(sh.filters) = 'object'
        GROUP BY key, value
        ORDER BY count DESC
        LIMIT 5
      `),
    ]);

    const totalUsers = usersCountRes.rows[0]?.total ?? 0;
    const activeUsers = activeUsersRes.rows[0]?.total ?? 0;
    const totalDatasets = datasetsCountRes.rows[0]?.total ?? 0;
    const totalRecords = recordsCountRes.rows[0]?.total ?? 0;
    const perf = perfStatsRes.rows[0] ?? { totalQueries: 0, avgLatencyMs: 0, cacheHits: 0 };
    const exports = exportStatsRes.rows[0] ?? { totalExports: 0, completedExports: 0, activeExports: 0 };
    const searchStats = searchStatsRes.rows[0] ?? {
      totalSearches: 0,
      searchesLast7Days: 0,
      avgLatencyMs: 0,
    };

    const health = {
      database: 'healthy',
      redis: 'healthy',
      server: 'online',
      uptimeSeconds: Math.floor(process.uptime()),
    };

    try {
      await this.pool.query('SELECT 1');
    } catch {
      health.database = 'degraded';
    }

    try {
      await this.redisService.ping();
    } catch {
      health.redis = 'degraded';
    }

    return {
      totalUsers,
      totalDatasets,
      totalRecords,
      metrics: {
        totalUsers,
        activeUsers,
        totalDatasets,
        totalRecords,
        totalQueries: perf.totalQueries,
        avgLatencyMs: perf.avgLatencyMs,
        cacheHitRate:
          perf.totalQueries > 0
            ? Math.round((perf.cacheHits / perf.totalQueries) * 100)
            : 0,
        totalExports: exports.totalExports,
        activeExports: exports.activeExports,
      },
      datasets: datasetStatsRes.rows,
      recentActivity: recentActivityRes.rows,
      growth: growthRes.rows,
      searchActivity: {
        totalSearches: searchStats.totalSearches,
        searchesLast7Days: searchStats.searchesLast7Days,
        avgLatencyMs: searchStats.avgLatencyMs,
        topFilters: topFiltersRes.rows,
      },
      health,
    };
  }

  /**
   * User Management: List users with roles
   */
  async getUsers(
    search?: string,
    page = 1,
    pageSize = 25,
    roleId?: string,
    status?: string,
  ) {
    const offset = (page - 1) * pageSize;
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (search && search.trim().length > 0) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(u.email ILIKE $${params.length} OR u.name ILIKE $${params.length})`);
    }

    if (roleId) {
      params.push(roleId);
      conditions.push(`u.role_id = $${params.length}`);
    }

    if (status === 'active') {
      conditions.push('u.email_verified = true');
    } else if (status === 'deactivated') {
      conditions.push('u.email_verified = false');
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
    try {
      const keys = await this.redisService.keys('auth:session:*');
      if (keys && keys.length > 0) {
        for (const key of keys) {
          const raw = await this.redisService.get(key);
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw) as { user?: { id?: string } };
            if (parsed?.user?.id === userId) {
              await this.redisService.del(key);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch {
      // best effort
    }

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
   * User Management: Inspect a single user's activity, sessions and exports
   */
  async getUserActivity(userId: string, page = 1, pageSize = 20) {
    const userRes = await this.pool.query(
      `SELECT u.id, u.name, u.email, u.email_verified AS "emailVerified", u.created_at AS "createdAt", r.name AS "roleName"
       FROM "user" u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [userId],
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    const offset = (page - 1) * pageSize;

    const [countRes, logsRes, summaryRes] = await Promise.all([
      this.pool.query(
        'SELECT count(*)::integer AS total FROM activity_logs WHERE user_id = $1',
        [userId],
      ),
      this.pool.query(
        `SELECT
           al.id,
           al.activity_type AS "activityType",
           al.action,
           al.description,
           al.resource_type AS "resourceType",
           al.metadata,
           al.created_at AS "createdAt"
         FROM activity_logs al
         WHERE al.user_id = $1
         ORDER BY al.created_at DESC
         LIMIT $2 OFFSET $3`,
        [userId, pageSize, offset],
      ),
      this.pool.query(
        `SELECT
           (SELECT count(*)::integer FROM activity_logs WHERE user_id = $1) AS "totalActions",
           (SELECT max(created_at) FROM activity_logs WHERE user_id = $1) AS "lastActiveAt",
           (SELECT count(*)::integer FROM session WHERE user_id = $1 AND expires_at > NOW()) AS "activeSessions",
           (SELECT count(*)::integer FROM search_history WHERE user_id = $1) AS "totalSearches",
           (SELECT count(*)::integer FROM export_jobs WHERE user_id = $1) AS "totalExports",
           (SELECT count(*)::integer FROM saved_views WHERE user_id = $1) AS "totalSavedViews"
        `,
        [userId],
      ),
    ]);

    const total = countRes.rows[0]?.total ?? 0;

    return {
      user: userRes.rows[0],
      summary: summaryRes.rows[0] ?? {
        totalActions: 0,
        lastActiveAt: null,
        activeSessions: 0,
        totalSearches: 0,
        totalExports: 0,
        totalSavedViews: 0,
      },
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
   * User Management: Force-reset a user's access by invalidating sessions
   */
  async resetUserAccess(userId: string, adminUser: AuthenticatedUser) {
    const userRes = await this.pool.query(
      'SELECT email FROM "user" WHERE id = $1',
      [userId],
    );

    if (userRes.rows.length === 0) {
      throw new NotFoundException('User not found');
    }

    await this.pool.query('DELETE FROM session WHERE user_id = $1', [userId]);
    await this.redisService.invalidatePattern(`cache:datasets:user:${userId}:*`);
    await this.redisService.invalidatePattern('cache:session:*');

    await this.logActivity(
      adminUser.id,
      'authentication',
      'USER_ACCESS_RESET',
      `Reset access and revoked all active sessions for '${userRes.rows[0].email}'`,
      'user',
      userId,
      { targetUserId: userId },
    );

    return {
      success: true,
      message: `All active sessions for '${userRes.rows[0].email}' have been revoked`,
    };
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

    // Notify users who have this role about permission changes
    try {
      const affected = await this.pool.query('SELECT id FROM "user" WHERE role_id = $1', [roleId]);
      for (const row of affected.rows as Array<{ id: string }>) {
        await this.pool.query(
          `INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            row.id,
            'permission_changed',
            'Permissions updated',
            `Your role permissions were updated by ${adminUser.name || 'an administrator'}.`,
            'role',
            roleId,
          ],
        );
      }
    } catch {
      // best effort
    }

    await this.logActivity(
      adminUser.id,
      'permission',
      'update_role_permissions',
      `Updated permissions for role '${roleRes.rows[0].name}' (${permissionIds.length} permissions assigned)`,
      'role',
      roleId,
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

    try {
      await this.pool.query(
        `INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          dto.userId,
          'dataset_access_changed',
          'Dataset access updated',
          `Your access to dataset "${datasetRes.rows[0].name}" was set to ${dto.accessLevel}.`,
          'dataset',
          datasetId,
        ],
      );
    } catch {}

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

    try {
      const dsRes = await this.pool.query('SELECT name FROM datasets WHERE id = $1', [datasetId]);
      await this.pool.query(
        `INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          userId,
          'dataset_access_changed',
          'Dataset access updated',
          `Your access to dataset "${dsRes.rows[0]?.name ?? 'a dataset'}" was removed.`,
          'dataset',
          datasetId,
        ],
      );
    } catch {}

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
   * Dataset Management: Create a dataset with optional field definitions
   */
  async createDataset(dto: CreateDatasetDto, adminUser: AuthenticatedUser) {
    const name = dto.name?.trim();
    if (!name) {
      throw new BadRequestException('Dataset name is required');
    }

    const client = await this.pool.connect();
    let datasetId: string;

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO datasets (name, description, category, data_source, owner_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          name,
          dto.description ?? null,
          dto.category ?? null,
          dto.dataSource ?? null,
          adminUser.id,
          dto.status ?? 'active',
        ],
      );

      datasetId = result.rows[0].id;

      if (dto.fields && dto.fields.length > 0) {
        await this.insertDatasetFields(client, datasetId, dto.fields);
      }

      await client.query(
        `INSERT INTO dataset_members (dataset_id, user_id, access_level, invited_by, updated_at)
         VALUES ($1, $2, 'manager', $2, NOW())
         ON CONFLICT (dataset_id, user_id) DO UPDATE SET access_level = 'manager', updated_at = NOW()`,
        [datasetId, adminUser.id],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_CREATED',
      `Created dataset '${name}'`,
      'dataset',
      datasetId,
      { datasetId, fieldCount: dto.fields?.length ?? 0 },
    );

    return this.fetchDatasetSummary(datasetId);
  }

  /**
   * Dataset Management: Update dataset metadata / status
   */
  async updateDataset(
    datasetId: string,
    dto: UpdateDatasetDto,
    adminUser: AuthenticatedUser,
  ) {
    await this.ensureDatasetExists(datasetId);

    const updates: string[] = [];
    const params: unknown[] = [datasetId];

    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new BadRequestException('Dataset name cannot be empty');
      }
      params.push(dto.name.trim());
      updates.push(`name = $${params.length}`);
    }
    if (dto.description !== undefined) {
      params.push(dto.description);
      updates.push(`description = $${params.length}`);
    }
    if (dto.category !== undefined) {
      params.push(dto.category);
      updates.push(`category = $${params.length}`);
    }
    if (dto.dataSource !== undefined) {
      params.push(dto.dataSource);
      updates.push(`data_source = $${params.length}`);
    }
    if (dto.status !== undefined) {
      params.push(dto.status);
      updates.push(`status = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.fetchDatasetSummary(datasetId);
    }

    updates.push('updated_at = NOW()');

    await this.pool.query(
      `UPDATE datasets SET ${updates.join(', ')} WHERE id = $1`,
      params,
    );

    await this.invalidateDatasetCaches();

    try {
      const members = await this.pool.query('SELECT user_id FROM dataset_members WHERE dataset_id = $1', [datasetId]);
      const dsNameRes = await this.pool.query('SELECT name FROM datasets WHERE id = $1', [datasetId]);
      const dsName = dsNameRes.rows[0]?.name ?? 'a dataset';
      for (const row of members.rows as Array<{ user_id: string }>) {
        await this.pool.query(
          `INSERT INTO notifications (user_id, type, title, message, resource_type, resource_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.user_id, 'dataset_updated', 'Dataset updated', `Dataset "${dsName}" was updated.`, 'dataset', datasetId],
        );
      }
    } catch {}

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_UPDATED',
      `Updated dataset metadata`,
      'dataset',
      datasetId,
      { datasetId, changes: dto },
    );

    return this.fetchDatasetSummary(datasetId);
  }

  /**
   * Dataset Management: Delete a dataset (cascades records, fields, members)
   */
  async deleteDataset(datasetId: string, adminUser: AuthenticatedUser) {
    const existing = await this.pool.query(
      'SELECT name FROM datasets WHERE id = $1',
      [datasetId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Dataset not found');
    }

    await this.pool.query('DELETE FROM datasets WHERE id = $1', [datasetId]);
    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_DELETED',
      `Deleted dataset '${existing.rows[0].name}'`,
      'dataset',
      datasetId,
      { datasetId },
    );

    return { success: true, message: `Dataset '${existing.rows[0].name}' deleted` };
  }

  /**
   * Dataset Management: List fields for a dataset
   */
  async getDatasetFields(datasetId: string) {
    await this.ensureDatasetExists(datasetId);

    const res = await this.pool.query(
      `SELECT
         id,
         dataset_id AS "datasetId",
         field_key AS "fieldKey",
         field_label AS "fieldLabel",
         data_type AS "dataType",
         is_required AS "isRequired",
         is_searchable AS "isSearchable",
         is_filterable AS "isFilterable",
         is_sortable AS "isSortable",
         position,
         field_config AS "fieldConfig"
       FROM dataset_fields
       WHERE dataset_id = $1
       ORDER BY position ASC, created_at ASC`,
      [datasetId],
    );

    return res.rows;
  }

  /**
   * Dataset Management: Add a field definition
   */
  async createDatasetField(
    datasetId: string,
    dto: CreateDatasetFieldDto,
    adminUser: AuthenticatedUser,
  ) {
    await this.ensureDatasetExists(datasetId);

    if (!dto.fieldKey?.trim() || !dto.fieldLabel?.trim()) {
      throw new BadRequestException('Field key and label are required');
    }

    const dataType = this.validateDataType(dto.dataType);

    const res = await this.pool.query(
      `INSERT INTO dataset_fields (
         dataset_id, field_key, field_label, data_type,
         is_required, is_searchable, is_filterable, is_sortable,
         position, field_config
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, dataset_id AS "datasetId", field_key AS "fieldKey", field_label AS "fieldLabel",
                 data_type AS "dataType", is_required AS "isRequired", is_searchable AS "isSearchable",
                 is_filterable AS "isFilterable", is_sortable AS "isSortable", position,
                 field_config AS "fieldConfig"`,
      [
        datasetId,
        dto.fieldKey.trim(),
        dto.fieldLabel.trim(),
        dataType,
        dto.isRequired ?? false,
        dto.isSearchable ?? false,
        dto.isFilterable ?? false,
        dto.isSortable ?? false,
        dto.position ?? 0,
        JSON.stringify(dto.fieldConfig ?? {}),
      ],
    );

    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_FIELD_CREATED',
      `Added field '${dto.fieldLabel}' to dataset`,
      'dataset',
      datasetId,
      { datasetId, fieldId: res.rows[0].id },
    );

    return res.rows[0];
  }

  /**
   * Dataset Management: Update a field definition
   */
  async updateDatasetField(
    datasetId: string,
    fieldId: string,
    dto: UpdateDatasetFieldDto,
    adminUser: AuthenticatedUser,
  ) {
    await this.ensureDatasetExists(datasetId);

    const existing = await this.pool.query(
      'SELECT id FROM dataset_fields WHERE id = $1 AND dataset_id = $2',
      [fieldId, datasetId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Dataset field not found');
    }

    const updates: string[] = [];
    const params: unknown[] = [fieldId, datasetId];

    if (dto.fieldKey !== undefined) {
      params.push(dto.fieldKey.trim());
      updates.push(`field_key = $${params.length}`);
    }
    if (dto.fieldLabel !== undefined) {
      params.push(dto.fieldLabel.trim());
      updates.push(`field_label = $${params.length}`);
    }
    if (dto.dataType !== undefined) {
      params.push(this.validateDataType(dto.dataType));
      updates.push(`data_type = $${params.length}`);
    }
    if (dto.isRequired !== undefined) {
      params.push(dto.isRequired);
      updates.push(`is_required = $${params.length}`);
    }
    if (dto.isSearchable !== undefined) {
      params.push(dto.isSearchable);
      updates.push(`is_searchable = $${params.length}`);
    }
    if (dto.isFilterable !== undefined) {
      params.push(dto.isFilterable);
      updates.push(`is_filterable = $${params.length}`);
    }
    if (dto.isSortable !== undefined) {
      params.push(dto.isSortable);
      updates.push(`is_sortable = $${params.length}`);
    }
    if (dto.position !== undefined) {
      params.push(dto.position);
      updates.push(`position = $${params.length}`);
    }
    if (dto.fieldConfig !== undefined) {
      params.push(JSON.stringify(dto.fieldConfig));
      updates.push(`field_config = $${params.length}`);
    }

    if (updates.length === 0) {
      return this.getDatasetFields(datasetId);
    }

    const res = await this.pool.query(
      `UPDATE dataset_fields
       SET ${updates.join(', ')}
       WHERE id = $1 AND dataset_id = $2
       RETURNING id, dataset_id AS "datasetId", field_key AS "fieldKey", field_label AS "fieldLabel",
                 data_type AS "dataType", is_required AS "isRequired", is_searchable AS "isSearchable",
                 is_filterable AS "isFilterable", is_sortable AS "isSortable", position,
                 field_config AS "fieldConfig"`,
      params,
    );

    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_FIELD_UPDATED',
      `Updated dataset field '${res.rows[0]?.fieldLabel ?? fieldId}'`,
      'dataset',
      datasetId,
      { datasetId, fieldId },
    );

    return res.rows[0];
  }

  /**
   * Dataset Management: Delete a field definition
   */
  async deleteDatasetField(
    datasetId: string,
    fieldId: string,
    adminUser: AuthenticatedUser,
  ) {
    const existing = await this.pool.query(
      'SELECT field_label FROM dataset_fields WHERE id = $1 AND dataset_id = $2',
      [fieldId, datasetId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Dataset field not found');
    }

    await this.pool.query(
      'DELETE FROM dataset_fields WHERE id = $1 AND dataset_id = $2',
      [fieldId, datasetId],
    );

    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_FIELD_DELETED',
      `Deleted dataset field '${existing.rows[0].field_label}'`,
      'dataset',
      datasetId,
      { datasetId, fieldId },
    );

    return { success: true };
  }

  /**
   * Dataset Management: Generate sample records based on field definitions
   */
  async generateDatasetRecords(
    datasetId: string,
    dto: GenerateDatasetRecordsDto,
    adminUser: AuthenticatedUser,
  ) {
    await this.ensureDatasetExists(datasetId);

    const fieldsRes = await this.pool.query(
      `SELECT field_key AS "fieldKey", field_label AS "fieldLabel", data_type AS "dataType", field_config AS "fieldConfig"
       FROM dataset_fields WHERE dataset_id = $1 ORDER BY position ASC`,
      [datasetId],
    );

    const fields = fieldsRes.rows as Array<{
      fieldKey: string;
      fieldLabel: string;
      dataType: DatasetFieldDataType;
      fieldConfig: Record<string, unknown>;
    }>;

    if (fields.length === 0) {
      throw new BadRequestException('Add at least one field before generating records');
    }

    const count = Math.min(5000, Math.max(1, Number(dto.count) || 100));
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      if (dto.clearExisting) {
        await client.query('DELETE FROM dataset_records WHERE dataset_id = $1', [datasetId]);
      }

      for (let i = 0; i < count; i += 1) {
        const recordData: Record<string, unknown> = {};
        for (const field of fields) {
          recordData[field.fieldKey] = this.generateFieldValue(field);
        }

        await client.query(
          `INSERT INTO dataset_records (dataset_id, record_data, created_by, updated_by)
           VALUES ($1, $2, $3, $3)`,
          [datasetId, JSON.stringify(recordData), adminUser.id],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_RECORDS_GENERATED',
      `Generated ${count} sample records`,
      'dataset',
      datasetId,
      { datasetId, count, clearedExisting: dto.clearExisting ?? false },
    );

    return { success: true, generated: count };
  }

  /**
   * Dataset Management: Import records supplied via JSON
   */
  async importDatasetRecords(
    datasetId: string,
    dto: ImportDatasetRecordsDto,
    adminUser: AuthenticatedUser,
  ) {
    await this.ensureDatasetExists(datasetId);

    if (!Array.isArray(dto.records) || dto.records.length === 0) {
      throw new BadRequestException('Provide at least one record to import');
    }

    if (dto.records.length > 5000) {
      throw new BadRequestException('A maximum of 5000 records can be imported at once');
    }

    const fieldsRes = await this.pool.query(
      'SELECT field_key AS "fieldKey" FROM dataset_fields WHERE dataset_id = $1',
      [datasetId],
    );

    const allowedKeys = new Set<string>(
      (fieldsRes.rows as Array<{ fieldKey: string }>).map((f) => f.fieldKey),
    );

    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      if (dto.clearExisting) {
        await client.query('DELETE FROM dataset_records WHERE dataset_id = $1', [datasetId]);
      }

      for (const record of dto.records) {
        const recordData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(record)) {
          if (allowedKeys.size === 0 || allowedKeys.has(key)) {
            recordData[key] = value;
          }
        }

        await client.query(
          `INSERT INTO dataset_records (dataset_id, record_data, created_by, updated_by)
           VALUES ($1, $2, $3, $3)`,
          [datasetId, JSON.stringify(recordData), adminUser.id],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.invalidateDatasetCaches();

    await this.logActivity(
      adminUser.id,
      'dataset',
      'DATASET_RECORDS_IMPORTED',
      `Imported ${dto.records.length} records`,
      'dataset',
      datasetId,
      { datasetId, count: dto.records.length, clearedExisting: dto.clearExisting ?? false },
    );

    return { success: true, imported: dto.records.length };
  }

  /**
   * Shared Views: List all saved views with owner, dataset and share counts
   */
  async getSharedViews() {
    const res = await this.pool.query(`
      SELECT
        sv.id,
        sv.name,
        sv.description,
        sv.is_shared AS "isShared",
        sv.created_at AS "createdAt",
        sv.updated_at AS "updatedAt",
        d.name AS "datasetName",
        u.name AS "ownerName",
        u.email AS "ownerEmail",
        count(svs.shared_with_user_id)::integer AS "shareCount"
      FROM saved_views sv
      JOIN datasets d ON d.id = sv.dataset_id
      JOIN "user" u ON u.id = sv.user_id
      LEFT JOIN saved_view_shares svs ON svs.saved_view_id = sv.id
      GROUP BY sv.id, sv.name, sv.description, sv.is_shared, sv.created_at, sv.updated_at, d.name, u.name, u.email
      ORDER BY sv.updated_at DESC
    `);

    return res.rows;
  }

  /**
   * Shared Views: Toggle cross-platform visibility of a saved view
   */
  async updateSharedView(
    viewId: string,
    dto: UpdateSharedViewDto,
    adminUser: AuthenticatedUser,
  ) {
    const existing = await this.pool.query(
      'SELECT name FROM saved_views WHERE id = $1',
      [viewId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Saved view not found');
    }

    const res = await this.pool.query(
      `UPDATE saved_views
       SET is_shared = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, is_shared AS "isShared", updated_at AS "updatedAt"`,
      [viewId, dto.isShared ?? false],
    );

    await this.logActivity(
      adminUser.id,
      'permission',
      'SHARED_VIEW_UPDATED',
      `Updated sharing for saved view '${existing.rows[0].name}'`,
      'saved_view',
      viewId,
      { viewId, isShared: dto.isShared ?? false },
    );

    return res.rows[0];
  }

  /**
   * Shared Views: Delete a shared saved view
   */
  async deleteSharedView(viewId: string, adminUser: AuthenticatedUser) {
    const existing = await this.pool.query(
      'SELECT name FROM saved_views WHERE id = $1',
      [viewId],
    );

    if (existing.rows.length === 0) {
      throw new NotFoundException('Saved view not found');
    }

    await this.pool.query('DELETE FROM saved_views WHERE id = $1', [viewId]);

    await this.logActivity(
      adminUser.id,
      'permission',
      'SHARED_VIEW_DELETED',
      `Deleted shared saved view '${existing.rows[0].name}'`,
      'saved_view',
      viewId,
      { viewId },
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

  private async ensureDatasetExists(
    datasetId: string,
  ): Promise<{ id: string; name: string }> {
    const res = await this.pool.query(
      'SELECT id, name FROM datasets WHERE id = $1',
      [datasetId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Dataset not found');
    }

    return res.rows[0] as { id: string; name: string };
  }

  private async fetchDatasetSummary(datasetId: string) {
    const res = await this.pool.query(
      `SELECT
         d.id,
         d.name,
         d.description,
         d.category,
         d.data_source AS "dataSource",
         d.status,
         d.created_at AS "createdAt",
         d.updated_at AS "updatedAt",
         COALESCE(rc.cnt, 0)::integer AS "recordCount",
         COALESCE(fc.cnt, 0)::integer AS "fieldCount"
       FROM datasets d
       LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_records GROUP BY dataset_id) rc ON rc.dataset_id = d.id
       LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_fields GROUP BY dataset_id) fc ON fc.dataset_id = d.id
       WHERE d.id = $1`,
      [datasetId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException('Dataset not found');
    }

    return { ...res.rows[0], members: [] };
  }

  private async insertDatasetFields(
    client: PoolClient,
    datasetId: string,
    fields: CreateDatasetFieldDto[],
  ): Promise<void> {
    for (let index = 0; index < fields.length; index += 1) {
      const field = fields[index];
      if (!field) continue;

      if (!field.fieldKey?.trim() || !field.fieldLabel?.trim()) {
        throw new BadRequestException('Every field requires a key and label');
      }

      await client.query(
        `INSERT INTO dataset_fields (
           dataset_id, field_key, field_label, data_type,
           is_required, is_searchable, is_filterable, is_sortable,
           position, field_config
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          datasetId,
          field.fieldKey.trim(),
          field.fieldLabel.trim(),
          this.validateDataType(field.dataType),
          field.isRequired ?? false,
          field.isSearchable ?? false,
          field.isFilterable ?? false,
          field.isSortable ?? false,
          field.position ?? index,
          JSON.stringify(field.fieldConfig ?? {}),
        ],
      );
    }
  }

  private validateDataType(dataType?: DatasetFieldDataType): DatasetFieldDataType {
    if (dataType === undefined) {
      return 'text';
    }

    const allowed: DatasetFieldDataType[] = [
      'text',
      'number',
      'boolean',
      'date',
      'email',
      'url',
    ];

    if (!allowed.includes(dataType)) {
      throw new BadRequestException(`Unsupported field data type '${dataType}'`);
    }

    return dataType;
  }

  private generateFieldValue(field: {
    fieldKey: string;
    fieldLabel: string;
    dataType: DatasetFieldDataType;
    fieldConfig: Record<string, unknown>;
  }): unknown {
    const config = field.fieldConfig ?? {};
    const options = Array.isArray(config.options)
      ? config.options.map((option) => String(option))
      : [];
    const min = typeof config.min === 'number' ? config.min : 1;
    const max = typeof config.max === 'number' ? config.max : 1000;
    const randomToken = Math.random().toString(36).slice(2, 10);

    if (options.length > 0) {
      const choice = options[Math.floor(Math.random() * options.length)];
      return choice ?? options[0];
    }

    switch (field.dataType) {
      case 'number':
        return Math.round((min + Math.random() * (max - min)) * 100) / 100;
      case 'boolean':
        return Math.random() > 0.5;
      case 'date':
        return new Date(
          Date.now() - Math.floor(Math.random() * 365) * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .slice(0, 10);
      case 'email':
        return `${field.fieldKey}.${randomToken}@example.com`;
      case 'url':
        return `https://example.com/${field.fieldKey}/${randomToken}`;
      default:
        return `${field.fieldLabel} ${randomToken}`;
    }
  }

  private async invalidateDatasetCaches(): Promise<void> {
    await this.redisService.invalidatePattern('cache:datasets:*');
    await this.redisService.invalidatePattern('cache:dataset_fields:*');
    await this.redisService.invalidatePattern('cache:analytics:*');
  }
}
