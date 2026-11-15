import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';
import { DatasetsService } from '../datasets/datasets.service.js';
import {
  FilterRule,
  RecordQueryParams,
  RecordListItem,
  PaginatedRecordsResponse,
  RecordRelationshipItem,
} from './dto/record-query.dto.js';

@Injectable()
export class RecordsService {
  private readonly logger = new Logger(RecordsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DatasetsService) private readonly datasetsService: DatasetsService,
  ) {}

  /**
   * Search, filter, sort, and paginate dataset records.
   */
  async findRecords(
    datasetId: string,
    query: RecordQueryParams,
    user: AuthenticatedUser,
  ): Promise<PaginatedRecordsResponse> {
    await this.datasetsService.checkDatasetAccess(datasetId, user);
    const fields = await this.datasetsService.findFieldsForDataset(datasetId, user);
    const fieldMap = new Map(fields.map((f) => [f.fieldKey, f]));

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 25));
    const offset = (page - 1) * pageSize;

    const params: unknown[] = [datasetId];
    const whereConditions: string[] = ['dataset_id = $1'];

    // 1. Global Search (q)
    if (query.q && typeof query.q === 'string' && query.q.trim().length > 0) {
      const searchTerm = query.q.trim();
      const searchableFields = fields.filter((f) => f.isSearchable);

      if (searchableFields.length > 0) {
        const searchClauses: string[] = [];
        params.push(`%${searchTerm}%`);
        const searchParamIndex = params.length;

        for (const f of searchableFields) {
          // Prevent SQL injection by using escaped key access in JSON
          searchClauses.push(
            `("record_data"->>'${f.fieldKey.replace(/'/g, "''")}') ILIKE $${searchParamIndex}`,
          );
        }
        whereConditions.push(`(${searchClauses.join(' OR ')})`);
      } else {
        params.push(`%${searchTerm}%`);
        whereConditions.push(`"record_data"::text ILIKE $${params.length}`);
      }
    }

    // 2. Dynamic Field Filters
    let filters: FilterRule[] = [];
    if (query.filters) {
      if (typeof query.filters === 'string') {
        try {
          filters = JSON.parse(query.filters);
        } catch {
          throw new BadRequestException('Invalid filters format: JSON string expected');
        }
      } else if (Array.isArray(query.filters)) {
        filters = query.filters;
      }
    }

    if (Array.isArray(filters) && filters.length > 0) {
      const filterClauses: string[] = [];

      for (const rule of filters) {
        if (!rule.field || !fieldMap.has(rule.field)) {
          continue; // Ignore un-whitelisted fields safely
        }

        const fieldDef = fieldMap.get(rule.field)!;
        const safeKey = rule.field.replace(/'/g, "''");
        const jsonAccess = `"record_data"->>'${safeKey}'`;

        switch (rule.operator) {
          case 'equals': {
            if (rule.value === undefined || rule.value === null || rule.value === '') break;
            if (fieldDef.dataType === 'number') {
              params.push(Number(rule.value));
              filterClauses.push(`((${jsonAccess})::numeric = $${params.length})`);
            } else if (fieldDef.dataType === 'boolean') {
              params.push(rule.value === true || rule.value === 'true');
              filterClauses.push(`((${jsonAccess})::boolean = $${params.length})`);
            } else {
              params.push(String(rule.value));
              filterClauses.push(`(${jsonAccess} = $${params.length})`);
            }
            break;
          }
          case 'not_equals': {
            if (rule.value === undefined || rule.value === null || rule.value === '') break;
            if (fieldDef.dataType === 'number') {
              params.push(Number(rule.value));
              filterClauses.push(`((${jsonAccess})::numeric != $${params.length} OR ${jsonAccess} IS NULL)`);
            } else {
              params.push(String(rule.value));
              filterClauses.push(`(${jsonAccess} != $${params.length} OR ${jsonAccess} IS NULL)`);
            }
            break;
          }
          case 'contains': {
            if (!rule.value) break;
            params.push(`%${rule.value}%`);
            filterClauses.push(`(${jsonAccess} ILIKE $${params.length})`);
            break;
          }
          case 'not_contains': {
            if (!rule.value) break;
            params.push(`%${rule.value}%`);
            filterClauses.push(`(${jsonAccess} NOT ILIKE $${params.length} OR ${jsonAccess} IS NULL)`);
            break;
          }
          case 'starts_with': {
            if (!rule.value) break;
            params.push(`${rule.value}%`);
            filterClauses.push(`(${jsonAccess} ILIKE $${params.length})`);
            break;
          }
          case 'ends_with': {
            if (!rule.value) break;
            params.push(`%${rule.value}`);
            filterClauses.push(`(${jsonAccess} ILIKE $${params.length})`);
            break;
          }
          case 'gt':
          case 'gte':
          case 'lt':
          case 'lte': {
            if (rule.value === undefined || rule.value === null || rule.value === '') break;
            const opSign =
              rule.operator === 'gt' ? '>' : rule.operator === 'gte' ? '>=' : rule.operator === 'lt' ? '<' : '<=';
            if (fieldDef.dataType === 'date') {
              params.push(rule.value);
              filterClauses.push(`((${jsonAccess})::timestamptz ${opSign} $${params.length}::timestamptz)`);
            } else {
              params.push(Number(rule.value));
              filterClauses.push(`((${jsonAccess})::numeric ${opSign} $${params.length})`);
            }
            break;
          }
          case 'between': {
            if (!Array.isArray(rule.value) || rule.value.length < 2) break;
            const [val1, val2] = rule.value;
            if (fieldDef.dataType === 'date') {
              params.push(val1);
              const p1 = params.length;
              params.push(val2);
              const p2 = params.length;
              filterClauses.push(`((${jsonAccess})::timestamptz BETWEEN $${p1}::timestamptz AND $${p2}::timestamptz)`);
            } else {
              params.push(Number(val1));
              const p1 = params.length;
              params.push(Number(val2));
              const p2 = params.length;
              filterClauses.push(`((${jsonAccess})::numeric BETWEEN $${p1} AND $${p2})`);
            }
            break;
          }
          case 'in': {
            if (!Array.isArray(rule.value) || rule.value.length === 0) break;
            params.push(rule.value.map(String));
            filterClauses.push(`(${jsonAccess} = ANY($${params.length}))`);
            break;
          }
          case 'is_null': {
            filterClauses.push(`(${jsonAccess} IS NULL OR "record_data"->'${safeKey}' = 'null'::jsonb)`);
            break;
          }
          case 'is_not_null': {
            filterClauses.push(`(${jsonAccess} IS NOT NULL AND "record_data"->'${safeKey}' != 'null'::jsonb)`);
            break;
          }
        }
      }

      if (filterClauses.length > 0) {
        const logic = query.filterLogic?.toUpperCase() === 'OR' ? ' OR ' : ' AND ';
        whereConditions.push(`(${filterClauses.join(logic)})`);
      }
    }

    // 3. Sorting & Whitelisting
    let orderExpression = 'created_at';
    if (query.sortBy && fieldMap.has(query.sortBy)) {
      const sortField = fieldMap.get(query.sortBy)!;
      const safeSortKey = query.sortBy.replace(/'/g, "''");
      if (sortField.dataType === 'number') {
        orderExpression = `("record_data"->>'${safeSortKey}')::numeric`;
      } else if (sortField.dataType === 'date') {
        orderExpression = `("record_data"->>'${safeSortKey}')::timestamptz`;
      } else if (sortField.dataType === 'boolean') {
        orderExpression = `("record_data"->>'${safeSortKey}')::boolean`;
      } else {
        orderExpression = `"record_data"->>'${safeSortKey}'`;
      }
    } else if (query.sortBy === 'id') {
      orderExpression = 'id';
    }

    const sortOrder = query.sortOrder?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 4. Count query
    const countQuery = `
      SELECT count(*)::integer AS total 
      FROM dataset_records 
      ${whereClause};
    `;
    const countResult = await this.pool.query(countQuery, params);
    const total = Number(countResult.rows[0]?.total ?? 0);

    // 5. Paginated rows query with stable tie-breaker
    const rowsQuery = `
      SELECT 
        id,
        dataset_id AS "datasetId",
        record_data AS "recordData",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM dataset_records
      ${whereClause}
      ORDER BY ${orderExpression} ${sortOrder} NULLS LAST, id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;

    const rowsResult = await this.pool.query(rowsQuery, [...params, pageSize, offset]);
    const data: RecordListItem[] = rowsResult.rows;

    return {
      success: true,
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Get single record by ID.
   */
  async findRecordById(
    datasetId: string,
    recordId: string,
    user: AuthenticatedUser,
  ): Promise<RecordListItem> {
    await this.datasetsService.checkDatasetAccess(datasetId, user);

    const query = `
      SELECT 
        id,
        dataset_id AS "datasetId",
        record_data AS "recordData",
        created_by AS "createdBy",
        updated_by AS "updatedBy",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM dataset_records
      WHERE dataset_id = $1 AND id = $2;
    `;

    const result = await this.pool.query(query, [datasetId, recordId]);
    if (result.rows.length === 0) {
      throw new NotFoundException(`Record with ID '${recordId}' not found in dataset`);
    }

    return result.rows[0];
  }

  /**
   * Get cross-dataset relationships for a record.
   */
  async findRecordRelationships(
    datasetId: string,
    recordId: string,
    user: AuthenticatedUser,
  ): Promise<RecordRelationshipItem[]> {
    await this.datasetsService.checkDatasetAccess(datasetId, user);

    const query = `
      SELECT 
        rr.id,
        rr.relationship_type AS "relationshipType",
        rr.description,
        rr.created_at AS "createdAt",
        CASE 
          WHEN rr.source_record_id = $2 THEN 'outgoing'
          ELSE 'incoming'
        END AS "direction",
        CASE 
          WHEN rr.source_record_id = $2 THEN rr.target_dataset_id
          ELSE rr.source_dataset_id
        END AS "relatedDatasetId",
        CASE 
          WHEN rr.source_record_id = $2 THEN d_target.name
          ELSE d_source.name
        END AS "relatedDatasetName",
        CASE 
          WHEN rr.source_record_id = $2 THEN d_target.category
          ELSE d_source.category
        END AS "relatedDatasetCategory",
        CASE 
          WHEN rr.source_record_id = $2 THEN rr.target_record_id
          ELSE rr.source_record_id
        END AS "relatedRecordId",
        CASE 
          WHEN rr.source_record_id = $2 THEN r_target.record_data
          ELSE r_source.record_data
        END AS "relatedRecordData"
      FROM record_relationships rr
      JOIN datasets d_source ON d_source.id = rr.source_dataset_id
      JOIN datasets d_target ON d_target.id = rr.target_dataset_id
      LEFT JOIN dataset_records r_source ON r_source.id = rr.source_record_id
      LEFT JOIN dataset_records r_target ON r_target.id = rr.target_record_id
      WHERE (rr.source_dataset_id = $1 AND rr.source_record_id = $2)
         OR (rr.target_dataset_id = $1 AND rr.target_record_id = $2)
      ORDER BY rr.created_at DESC;
    `;

    const result = await this.pool.query(query, [datasetId, recordId]);
    return result.rows;
  }
}
