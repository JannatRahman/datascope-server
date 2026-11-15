import {
  Injectable,
  Inject,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { PG_POOL } from '../../core/constants.js';
import { ROLES, AuthenticatedUser } from '../auth/types/auth.types.js';
import { DatasetsService } from '../datasets/datasets.service.js';
import { FilterRule } from '../records/dto/record-query.dto.js';
import { CreateExportDto, ExportJobItem } from './dto/export.dto.js';

@Injectable()
export class ExportsService {
  private readonly logger = new Logger(ExportsService.name);
  private readonly storageDir = path.resolve(process.cwd(), 'storage', 'exports');

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(DatasetsService) private readonly datasetsService: DatasetsService,
  ) {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Request and trigger an asynchronous data export.
   * Viewers are forbidden from exporting by default.
   */
  async createExportJob(
    datasetId: string,
    dto: CreateExportDto,
    user: AuthenticatedUser,
  ): Promise<ExportJobItem> {
    // 1. RBAC Check: Viewers cannot export data
    if (user.roleName === ROLES.VIEWER) {
      throw new ForbiddenException('Viewers do not have permission to export dataset records');
    }

    // 2. Validate dataset access
    const dataset = await this.datasetsService.findOneForUser(datasetId, user);
    const format = dto.format === 'json' ? 'json' : 'csv';

    // 3. Create initial processing job in export_jobs
    const insertQuery = `
      INSERT INTO export_jobs (
        user_id,
        dataset_id,
        status,
        format,
        export_config,
        started_at
      )
      VALUES ($1, $2, 'processing', $3, $4, NOW())
      RETURNING 
        id,
        user_id AS "userId",
        dataset_id AS "datasetId",
        status,
        format,
        export_config AS "exportConfig",
        requested_at AS "requestedAt",
        started_at AS "startedAt";
    `;

    const jobResult = await this.pool.query(insertQuery, [
      user.id,
      datasetId,
      format,
      JSON.stringify(dto),
    ]);

    const job: ExportJobItem = {
      ...jobResult.rows[0],
      datasetName: dataset.name,
      userName: user.name,
    };

    // 4. Trigger bounded-memory streaming export generation
    this.processExportAsync(job.id, datasetId, dataset.name, dto, format, user).catch((err) => {
      this.logger.error(`Background export job failed for id ${job.id}:`, err);
    });

    return job;
  }

  /**
   * Cancel an in-progress export job
   */
  async cancelExportJob(jobId: string, user: AuthenticatedUser) {
    const jobRes = await this.pool.query('SELECT user_id, status FROM export_jobs WHERE id = $1', [jobId]);
    if (jobRes.rows.length === 0) throw new NotFoundException('Export job not found');

    if (jobRes.rows[0].user_id !== user.id && user.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('You can only cancel your own export jobs');
    }

    if (jobRes.rows[0].status === 'completed' || jobRes.rows[0].status === 'failed') {
      throw new BadRequestException(`Cannot cancel export job with status "${jobRes.rows[0].status}"`);
    }

    await this.pool.query(
      `UPDATE export_jobs SET status = 'cancelled', completed_at = NOW() WHERE id = $1`,
      [jobId],
    );

    return { success: true, message: 'Export job cancelled' };
  }

  /**
   * Bounded-memory streaming export processing.
   * Chunks records in batches of 2,500 using file streams to prevent high memory usage.
   */
  private async processExportAsync(
    jobId: string,
    datasetId: string,
    datasetName: string,
    dto: CreateExportDto,
    format: 'csv' | 'json',
    user: AuthenticatedUser,
  ): Promise<void> {
    const ext = format === 'json' ? 'json' : 'csv';
    const filePath = path.join(this.storageDir, `${jobId}.${ext}`);
    const safeDatasetName = datasetName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    const fileName = `${safeDatasetName}_export_${Date.now()}.${ext}`;

    try {
      const allFields = await this.datasetsService.findFieldsForDataset(datasetId, user);
      const fieldMap = new Map(allFields.map((f) => [f.fieldKey, f]));

      let exportFields = allFields;
      if (Array.isArray(dto.selectedFields) && dto.selectedFields.length > 0) {
        exportFields = allFields.filter((f) => dto.selectedFields!.includes(f.fieldKey));
      }
      if (exportFields.length === 0) {
        exportFields = allFields;
      }

      // Build WHERE conditions matching filters
      const params: unknown[] = [datasetId];
      const whereConditions: string[] = ['dataset_id = $1'];

      let filters: FilterRule[] = [];
      if (dto.filters) {
        if (typeof dto.filters === 'string') {
          try {
            filters = JSON.parse(dto.filters);
          } catch {
            filters = [];
          }
        } else if (Array.isArray(dto.filters)) {
          filters = dto.filters;
        }
      }

      if (filters.length > 0) {
        const filterClauses: string[] = [];
        for (const rule of filters) {
          if (!rule.field || !fieldMap.has(rule.field)) continue;
          const fieldDef = fieldMap.get(rule.field)!;
          const safeKey = rule.field.replace(/'/g, "''");
          const jsonAccess = `"record_data"->>'${safeKey}'`;

          switch (rule.operator) {
            case 'equals':
              if (rule.value === undefined || rule.value === null || rule.value === '') break;
              if (fieldDef.dataType === 'number') {
                params.push(Number(rule.value));
                filterClauses.push(`((${jsonAccess})::numeric = $${params.length})`);
              } else {
                params.push(String(rule.value));
                filterClauses.push(`(${jsonAccess} = $${params.length})`);
              }
              break;
            case 'not_equals':
              if (rule.value === undefined || rule.value === null || rule.value === '') break;
              params.push(String(rule.value));
              filterClauses.push(`(${jsonAccess} != $${params.length} OR ${jsonAccess} IS NULL)`);
              break;
            case 'contains':
              if (!rule.value) break;
              params.push(`%${rule.value}%`);
              filterClauses.push(`(${jsonAccess} ILIKE $${params.length})`);
              break;
            case 'gt':
            case 'gte':
            case 'lt':
            case 'lte': {
              if (rule.value === undefined || rule.value === null || rule.value === '') break;
              const opSign =
                rule.operator === 'gt' ? '>' : rule.operator === 'gte' ? '>=' : rule.operator === 'lt' ? '<' : '<=';
              params.push(Number(rule.value));
              filterClauses.push(`((${jsonAccess})::numeric ${opSign} $${params.length})`);
              break;
            }
          }
        }

        if (filterClauses.length > 0) {
          const logic = dto.filterLogic?.toUpperCase() === 'OR' ? ' OR ' : ' AND ';
          whereConditions.push(`(${filterClauses.join(logic)})`);
        }
      }

      // Sorting
      let orderExpression = 'created_at';
      if (dto.sortBy && fieldMap.has(dto.sortBy)) {
        const safeSortKey = dto.sortBy.replace(/'/g, "''");
        orderExpression = `"record_data"->>'${safeSortKey}'`;
      }
      const sortOrder = dto.sortOrder?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
      const whereClause = whereConditions.join(' AND ');

      // Total count
      const countRes = await this.pool.query(
        `SELECT count(*)::integer AS total FROM dataset_records WHERE ${whereClause}`,
        params,
      );
      const totalCount = countRes.rows[0]?.total ?? 0;

      // Update total records in job
      await this.pool.query('UPDATE export_jobs SET total_records = $1 WHERE id = $2', [totalCount, jobId]);

      // Stream file creation
      const writeStream = fs.createWriteStream(filePath, { encoding: 'utf-8' });

      const sanitizeCell = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
          str = `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      if (format === 'csv') {
        const headerLine = exportFields.map((f) => sanitizeCell(f.fieldLabel)).join(',');
        writeStream.write(headerLine + '\r\n');
      } else {
        writeStream.write('[\n');
      }

      const CHUNK_SIZE = 2500;
      let offset = 0;
      let processed = 0;
      let isFirstJsonRecord = true;

      while (offset < totalCount) {
        // Check if cancelled
        const cancelCheck = await this.pool.query('SELECT status FROM export_jobs WHERE id = $1', [jobId]);
        if (cancelCheck.rows[0]?.status === 'cancelled') {
          writeStream.end();
          try { fs.unlinkSync(filePath); } catch { }
          return;
        }

        const chunkParams = [...params, CHUNK_SIZE, offset];
        const chunkQuery = `
          SELECT record_data AS "recordData"
          FROM dataset_records
          WHERE ${whereClause}
          ORDER BY ${orderExpression} ${sortOrder} NULLS LAST, id ASC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2};
        `;

        const chunkResult = await this.pool.query(chunkQuery, chunkParams);
        const rows = chunkResult.rows;
        if (rows.length === 0) break;

        if (format === 'csv') {
          let chunkText = '';
          for (const row of rows) {
            const rd = row.recordData || {};
            chunkText += exportFields.map((f) => sanitizeCell(rd[f.fieldKey])).join(',') + '\r\n';
          }
          writeStream.write(chunkText);
        } else {
          let chunkText = '';
          for (const row of rows) {
            const rd = row.recordData || {};
            const recordObj: Record<string, unknown> = {};
            for (const f of exportFields) {
              recordObj[f.fieldKey] = rd[f.fieldKey] ?? null;
            }
            const recordJson = JSON.stringify(recordObj);
            chunkText += (isFirstJsonRecord ? '  ' : ',\n  ') + recordJson;
            isFirstJsonRecord = false;
          }
          writeStream.write(chunkText);
        }

        processed += rows.length;
        offset += CHUNK_SIZE;

        // Update progress in database
        await this.pool.query(
          'UPDATE export_jobs SET processed_records = $1 WHERE id = $2',
          [processed, jobId],
        );
      }

      if (format === 'json') {
        writeStream.write('\n]\n');
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => resolve());
        writeStream.on('error', reject);
      });

      // Update export job to completed
      await this.pool.query(
        `UPDATE export_jobs
         SET 
           status = 'completed',
           file_path = $1,
           file_name = $2,
           total_records = $3,
           processed_records = $3,
           completed_at = NOW(),
           expires_at = NOW() + INTERVAL '7 days'
         WHERE id = $4;`,
        [filePath, fileName, processed, jobId],
      );

      // Notification
      await this.createNotification(
        user.id,
        'export_completed',
        'Export Ready',
        `Your export for dataset "${datasetName}" (${processed.toLocaleString()} records) has finished and is ready for download.`,
        'export_job',
        jobId,
      );

      // Activity log
      await this.logActivity(
        user.id,
        'dataset',
        'export_dataset',
        `Generated ${format.toUpperCase()} export for "${datasetName}" (${processed} records)`,
        'dataset',
        datasetId,
      );

      this.logger.log(`Export job ${jobId} completed successfully with ${processed} records.`);
    } catch (err: any) {
      this.logger.error(`Export job ${jobId} failed:`, err);
      await this.pool.query(
        `UPDATE export_jobs SET status = 'failed', error_message = $1, completed_at = NOW() WHERE id = $2;`,
        [err.message || 'Export generation failed', jobId],
      );

      await this.createNotification(
        user.id,
        'export_failed',
        'Export Failed',
        `Your export for dataset "${datasetName}" failed: ${err.message || 'Unknown error'}`,
        'export_job',
        jobId,
      );
    }
  }

  /**
   * List export jobs for user (or all if admin).
   */
  async findAll(user: AuthenticatedUser): Promise<ExportJobItem[]> {
    const isAdmin = user.roleName === ROLES.ADMINISTRATOR;
    const whereClause = isAdmin ? '' : 'WHERE ej.user_id = $1';
    const params = isAdmin ? [] : [user.id];

    const query = `
      SELECT 
        ej.id,
        ej.user_id AS "userId",
        u.name AS "userName",
        ej.dataset_id AS "datasetId",
        d.name AS "datasetName",
        ej.status,
        ej.format,
        ej.export_config AS "exportConfig",
        ej.file_name AS "fileName",
        ej.total_records AS "totalRecords",
        ej.processed_records AS "processedRecords",
        ej.error_message AS "errorMessage",
        ej.requested_at AS "requestedAt",
        ej.started_at AS "startedAt",
        ej.completed_at AS "completedAt"
      FROM export_jobs ej
      LEFT JOIN datasets d ON d.id = ej.dataset_id
      LEFT JOIN "user" u ON u.id = ej.user_id
      ${whereClause}
      ORDER BY ej.requested_at DESC
      LIMIT 100;
    `;

    const result = await this.pool.query(query, params);
    return result.rows.map((r) => ({
      ...r,
      totalRecords: r.totalRecords ? Number(r.totalRecords) : null,
      processedRecords: Number(r.processedRecords || 0),
    }));
  }

  /**
   * Get single export job status.
   */
  async findOne(jobId: string, user: AuthenticatedUser): Promise<ExportJobItem> {
    const query = `
      SELECT 
        ej.id,
        ej.user_id AS "userId",
        u.name AS "userName",
        ej.dataset_id AS "datasetId",
        d.name AS "datasetName",
        ej.status,
        ej.format,
        ej.export_config AS "exportConfig",
        ej.file_name AS "fileName",
        ej.total_records AS "totalRecords",
        ej.processed_records AS "processedRecords",
        ej.error_message AS "errorMessage",
        ej.requested_at AS "requestedAt",
        ej.started_at AS "startedAt",
        ej.completed_at AS "completedAt"
      FROM export_jobs ej
      LEFT JOIN datasets d ON d.id = ej.dataset_id
      LEFT JOIN "user" u ON u.id = ej.user_id
      WHERE ej.id = $1;
    `;

    const result = await this.pool.query(query, [jobId]);
    if (result.rows.length === 0) {
      throw new NotFoundException(`Export job with ID ${jobId} not found`);
    }

    const job = result.rows[0];
    if (user.roleName !== ROLES.ADMINISTRATOR && job.userId !== user.id) {
      throw new ForbiddenException('You do not have access to this export job');
    }

    return {
      ...job,
      totalRecords: job.totalRecords ? Number(job.totalRecords) : null,
      processedRecords: Number(job.processedRecords || 0),
    };
  }

  /**
   * Get generated export file for download.
   */
  async getExportFile(jobId: string, user: AuthenticatedUser): Promise<{ filePath: string; fileName: string; format: string }> {
    const query = `
      SELECT id, user_id AS "userId", status, format, file_path AS "filePath", file_name AS "fileName"
      FROM export_jobs
      WHERE id = $1;
    `;
    const result = await this.pool.query(query, [jobId]);
    if (result.rows.length === 0) {
      throw new NotFoundException(`Export job with ID ${jobId} not found`);
    }

    const job = result.rows[0];
    if (user.roleName !== ROLES.ADMINISTRATOR && job.userId !== user.id) {
      throw new ForbiddenException('You do not have access to download this export file');
    }

    if (job.status !== 'completed' || !job.filePath) {
      throw new BadRequestException(`Export file is not ready for download. Current status: ${job.status}`);
    }

    if (!fs.existsSync(job.filePath)) {
      throw new NotFoundException('Export file not found on disk or has expired');
    }

    return {
      filePath: job.filePath,
      fileName: job.fileName || `export_${jobId}.${job.format || 'csv'}`,
      format: job.format || 'csv',
    };
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
    } catch { }
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
    } catch { }
  }
}
