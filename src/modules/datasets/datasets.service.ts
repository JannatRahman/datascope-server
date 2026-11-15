import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';
import { DatasetListItem, DatasetFieldItem } from './dto/dataset.dto.js';

@Injectable()
export class DatasetsService {
  private readonly logger = new Logger(DatasetsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(RedisService) private readonly redisService: RedisService,
  ) {}

  /**
   * Check if a user has access to a dataset and return their access level.
   * Throws NotFoundException if dataset does not exist.
   * Throws ForbiddenException if user lacks access.
   */
  async checkDatasetAccess(
    datasetId: string,
    user: AuthenticatedUser,
  ): Promise<{ accessLevel: 'viewer' | 'editor' | 'manager'; datasetName: string }> {
    // Administrator has manager access to everything
    if (user.roleName === ROLES.ADMINISTRATOR) {
      const res = await this.pool.query(
        'SELECT id, name FROM datasets WHERE id = $1 AND status = $2',
        [datasetId, 'active'],
      );
      if (res.rows.length === 0) {
        throw new NotFoundException(`Dataset with ID '${datasetId}' not found`);
      }
      return { accessLevel: 'manager', datasetName: res.rows[0].name };
    }

    // Check ownership or dataset membership
    const res = await this.pool.query(
      `SELECT d.id, d.name, d.owner_id, dm.access_level
       FROM datasets d
       LEFT JOIN dataset_members dm ON dm.dataset_id = d.id AND dm.user_id = $2
       WHERE d.id = $1 AND d.status = 'active'`,
      [datasetId, user.id],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Dataset with ID '${datasetId}' not found`);
    }

    const row = res.rows[0];
    if (row.owner_id === user.id) {
      return { accessLevel: 'manager', datasetName: row.name };
    }

    if (row.access_level) {
      return { accessLevel: row.access_level, datasetName: row.name };
    }

    throw new ForbiddenException('You do not have permission to access this dataset');
  }

  /**
   * List all datasets accessible to the authenticated user.
   */
  async findAllForUser(user: AuthenticatedUser): Promise<DatasetListItem[]> {
    const cacheKey = `cache:datasets:user:${user.id}:${user.roleName}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis get error for ${cacheKey}:`, err);
    }

    const query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.category,
        d.data_source AS "dataSource",
        d.status,
        d.owner_id AS "ownerId",
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        COALESCE(rc.record_count, 0)::integer AS "recordCount",
        COALESCE(fc.field_count, 0)::integer AS "fieldCount",
        CASE 
          WHEN $1 = '${ROLES.ADMINISTRATOR}' THEN 'manager'
          WHEN d.owner_id = $2 THEN 'manager'
          ELSE COALESCE(dm.access_level, 'viewer')
        END AS "accessLevel"
      FROM datasets d
      LEFT JOIN (
        SELECT dataset_id, count(*)::integer AS record_count 
        FROM dataset_records 
        GROUP BY dataset_id
      ) rc ON rc.dataset_id = d.id
      LEFT JOIN (
        SELECT dataset_id, count(*)::integer AS field_count 
        FROM dataset_fields 
        GROUP BY dataset_id
      ) fc ON fc.dataset_id = d.id
      LEFT JOIN dataset_members dm ON dm.dataset_id = d.id AND dm.user_id = $2
      WHERE d.status = 'active'
        AND (
          $1 = '${ROLES.ADMINISTRATOR}' 
          OR d.owner_id = $2 
          OR dm.user_id IS NOT NULL
        )
      ORDER BY d.created_at ASC;
    `;

    const result = await this.pool.query(query, [user.roleName, user.id]);
    const items: DatasetListItem[] = result.rows.map((r) => ({
      ...r,
      recordCount: Number(r.recordCount),
      fieldCount: Number(r.fieldCount),
    }));

    try {
      await this.redisService.set(cacheKey, JSON.stringify(items), 60);
    } catch (err) {
      this.logger.warn(`Redis set error for ${cacheKey}:`, err);
    }

    return items;
  }

  /**
   * Get dataset details by ID.
   */
  async findOneForUser(
    datasetId: string,
    user: AuthenticatedUser,
  ): Promise<DatasetListItem> {
    const { accessLevel } = await this.checkDatasetAccess(datasetId, user);

    const query = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.category,
        d.data_source AS "dataSource",
        d.status,
        d.owner_id AS "ownerId",
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        COALESCE(rc.record_count, 0)::integer AS "recordCount",
        COALESCE(fc.field_count, 0)::integer AS "fieldCount"
      FROM datasets d
      LEFT JOIN (
        SELECT count(*)::integer AS record_count 
        FROM dataset_records 
        WHERE dataset_id = $1
      ) rc ON true
      LEFT JOIN (
        SELECT count(*)::integer AS field_count 
        FROM dataset_fields 
        WHERE dataset_id = $1
      ) fc ON true
      WHERE d.id = $1 AND d.status = 'active';
    `;

    const result = await this.pool.query(query, [datasetId]);
    if (result.rows.length === 0) {
      throw new NotFoundException(`Dataset with ID '${datasetId}' not found`);
    }

    const row = result.rows[0];
    return {
      ...row,
      recordCount: Number(row.recordCount),
      fieldCount: Number(row.fieldCount),
      accessLevel,
    };
  }

  /**
   * Get all fields for a dataset.
   */
  async findFieldsForDataset(
    datasetId: string,
    user: AuthenticatedUser,
  ): Promise<DatasetFieldItem[]> {
    await this.checkDatasetAccess(datasetId, user);

    const cacheKey = `cache:dataset_fields:${datasetId}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn(`Redis get error for ${cacheKey}:`, err);
    }

    const query = `
      SELECT 
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
      ORDER BY position ASC, created_at ASC;
    `;

    const result = await this.pool.query(query, [datasetId]);
    const fields: DatasetFieldItem[] = result.rows;

    try {
      await this.redisService.set(cacheKey, JSON.stringify(fields), 300);
    } catch (err) {
      this.logger.warn(`Redis set error for ${cacheKey}:`, err);
    }

    return fields;
  }
}
