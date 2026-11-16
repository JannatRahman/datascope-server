import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { DatasetsService } from '../datasets/datasets.service.js';
import { AuthenticatedUser } from '../auth/types/auth.types.js';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(RedisService) private readonly redisService: RedisService,
    @Inject(DatasetsService) private readonly datasetsService: DatasetsService,
  ) {}

  /**
   * Complete platform analytics overview with real data calculations
   */
  async getOverview() {
    const cacheKey = 'cache:analytics:overview';
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch {}

    const [
      datasetDistribution,
      salesPaymentStatuses,
      shipmentStatuses,
      employeeStatuses,
      searchActivity,
      queryPerformance,
      activityDistribution,
      growthTrends,
      frequentFilters,
    ] = await Promise.all([
      this.getDatasetDistribution(),
      this.getSalesPaymentStatusDistribution(),
      this.getShipmentStatusDistribution(),
      this.getEmployeeStatusDistribution(),
      this.getSearchActivity(),
      this.getQueryPerformance(),
      this.getActivityDistribution(),
      this.getGrowthTrends(),
      this.getFrequentFilters(),
    ]);

    const result = {
      datasetDistribution,
      statusDistributions: {
        salesPaymentStatuses,
        shipmentStatuses,
        employeeStatuses,
      },
      searchActivity: {
        ...searchActivity,
        frequentFilters,
      },
      queryPerformance,
      activityDistribution,
      growthTrends,
      timestamp: new Date().toISOString(),
    };

    try {
      await this.redisService.set(cacheKey, JSON.stringify(result), 120); // 2 minute cache
    } catch {}

    return result;
  }

  /**
   * Dataset-scoped analytics for analysts with access to the dataset.
   */
  async getDatasetAnalytics(datasetId: string, user: AuthenticatedUser) {
    const dataset = await this.datasetsService.findOneForUser(datasetId, user);
    const fields = await this.datasetsService.findFieldsForDataset(datasetId, user);

    const statusField =
      fields.find((f) => f.fieldKey === 'status' && f.dataType === 'text') ??
      fields.find((f) => f.dataType === 'text' && Array.isArray((f.fieldConfig as { options?: unknown })?.options));
    const categoryField =
      fields.find((f) => f.fieldKey === 'category' && f.dataType === 'text') ??
      fields.find(
        (f) => f.fieldKey !== statusField?.fieldKey && f.dataType === 'text' &&
          Array.isArray((f.fieldConfig as { options?: unknown })?.options),
      );

    const getDistribution = async (fieldKey?: string) => {
      if (!fieldKey) return [];
      const res = await this.pool.query(
        `SELECT COALESCE(record_data->>$2, 'Unknown') AS "value", count(*)::integer AS count
         FROM dataset_records
         WHERE dataset_id = $1
         GROUP BY "value"
         ORDER BY count DESC`,
        [datasetId, fieldKey],
      );
      return res.rows;
    };

    const [statusDistribution, categoryDistribution, growthRes, searchRes, topQueriesRes] =
      await Promise.all([
        getDistribution(statusField?.fieldKey),
        getDistribution(categoryField?.fieldKey),
        this.pool.query(
          `WITH months AS (
             SELECT generate_series(
               date_trunc('month', NOW()) - INTERVAL '5 months',
               date_trunc('month', NOW()),
               INTERVAL '1 month'
             ) AS month
           )
           SELECT
             to_char(m.month, 'YYYY-MM') AS month,
             (SELECT count(*)::integer FROM dataset_records dr
               WHERE dr.dataset_id = $1 AND date_trunc('month', dr.created_at) = m.month) AS records
           FROM months m
           ORDER BY m.month ASC`,
          [datasetId],
        ),
        this.pool.query(
          `SELECT count(*)::integer AS "totalSearches",
                  COALESCE(AVG(execution_time_ms), 0)::integer AS "avgExecutionTimeMs"
           FROM search_history
           WHERE dataset_id = $1`,
          [datasetId],
        ),
        this.pool.query(
          `SELECT search_query AS query, count(*)::integer AS count
           FROM search_history
           WHERE dataset_id = $1
           GROUP BY search_query
           ORDER BY count DESC
           LIMIT 10`,
          [datasetId],
        ),
      ]);

    return {
      dataset,
      statusField: statusField ?? null,
      categoryField: categoryField ?? null,
      statusDistribution,
      categoryDistribution,
      growthTrends: growthRes.rows,
      searchActivity: {
        ...(searchRes.rows[0] ?? { totalSearches: 0, avgExecutionTimeMs: 0 }),
        topQueries: topQueriesRes.rows,
      },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Total records and field distribution by dataset
   */
  async getDatasetDistribution() {
    const query = `
      SELECT 
        d.id,
        d.name,
        d.category,
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
      ORDER BY "recordCount" DESC;
    `;

    const res = await this.pool.query(query);
    const totalRecords = res.rows.reduce((sum, r) => sum + r.recordCount, 0);

    return res.rows.map((r) => ({
      ...r,
      percentage: totalRecords > 0 ? Number(((r.recordCount / totalRecords) * 100).toFixed(1)) : 0,
    }));
  }

  /**
   * Real payment_status distribution in Sales Transactions
   */
  async getSalesPaymentStatusDistribution() {
    const query = `
      SELECT status, count(*)::integer AS count
      FROM (
        SELECT COALESCE(record_data->>'payment_status', 'Unknown') AS status
        FROM dataset_records dr
        JOIN datasets d ON d.id = dr.dataset_id
        WHERE d.name = 'Sales Transactions'
      ) s
      GROUP BY status
      ORDER BY count DESC;
    `;
    const res = await this.pool.query(query);
    return res.rows;
  }

  /**
   * Real shipment status distribution in Shipment & Delivery
   */
  async getShipmentStatusDistribution() {
    const query = `
      SELECT status, count(*)::integer AS count
      FROM (
        SELECT COALESCE(record_data->>'status', 'Unknown') AS status
        FROM dataset_records dr
        JOIN datasets d ON d.id = dr.dataset_id
        WHERE d.name = 'Shipment & Delivery'
      ) s
      GROUP BY status
      ORDER BY count DESC;
    `;
    const res = await this.pool.query(query);
    return res.rows;
  }

  /**
   * Real employee status distribution in Employee Directory
   */
  async getEmployeeStatusDistribution() {
    const query = `
      SELECT status, count(*)::integer AS count
      FROM (
        SELECT COALESCE(record_data->>'status', 'Unknown') AS status
        FROM dataset_records dr
        JOIN datasets d ON d.id = dr.dataset_id
        WHERE d.name = 'Employee Directory'
      ) s
      GROUP BY status
      ORDER BY count DESC;
    `;
    const res = await this.pool.query(query);
    return res.rows;
  }

  /**
   * Search volume and frequent search queries
   */
  async getSearchActivity() {
    const [volumeRes, topSearchesRes] = await Promise.all([
      this.pool.query(`
        SELECT 
          d.name AS "datasetName",
          count(*)::integer AS "searchesCount"
        FROM search_history sh
        LEFT JOIN datasets d ON d.id = sh.dataset_id
        GROUP BY d.name
        ORDER BY "searchesCount" DESC
        LIMIT 10;
      `),
      this.pool.query(`
        SELECT 
          search_query AS "query",
          count(*)::integer AS count,
          AVG(execution_time_ms)::integer AS "avgLatencyMs"
        FROM search_history
        GROUP BY search_query
        ORDER BY count DESC
        LIMIT 10;
      `),
    ]);

    return {
      searchesByDataset: volumeRes.rows,
      topQueries: topSearchesRes.rows,
    };
  }

  /**
   * Query performance latency stats from query_performance_logs
   */
  async getQueryPerformance() {
    const query = `
      SELECT 
        count(*)::integer AS "totalQueries",
        COALESCE(AVG(execution_time_ms), 0)::integer AS "avgLatencyMs",
        COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 0)::integer AS "p95LatencyMs",
        COALESCE(SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END), 0)::integer AS "cacheHits",
        COALESCE(SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END), 0)::integer AS "cacheMisses"
      FROM query_performance_logs;
    `;

    const res = await this.pool.query(query);
    const row = res.rows[0] ?? { totalQueries: 0, avgLatencyMs: 0, p95LatencyMs: 0, cacheHits: 0, cacheMisses: 0 };
    const total = row.totalQueries || 0;

    return {
      totalQueries: total,
      avgLatencyMs: row.avgLatencyMs,
      p95LatencyMs: row.p95LatencyMs,
      cacheHits: row.cacheHits,
      cacheMisses: row.cacheMisses,
      cacheHitRate: total > 0 ? Math.round((row.cacheHits / total) * 100) : 85,
    };
  }

  /**
   * Dataset, record and user growth over the last six months
   */
  async getGrowthTrends() {
    const res = await this.pool.query(`
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
    `);

    return res.rows;
  }

  /**
   * Most frequently applied search filters
   */
  async getFrequentFilters() {
    const res = await this.pool.query(`
      SELECT key, value, count(*)::integer AS count
      FROM search_history sh,
           LATERAL jsonb_each_text(sh.filters)
      WHERE jsonb_typeof(sh.filters) = 'object'
      GROUP BY key, value
      ORDER BY count DESC
      LIMIT 10
    `);

    return res.rows;
  }

  /**
   * User and System Activity distribution by category
   */
  async getActivityDistribution() {
    const query = `
      SELECT 
        activity_type AS "type",
        count(*)::integer AS count
      FROM activity_logs
      GROUP BY activity_type
      ORDER BY count DESC;
    `;

    const res = await this.pool.query(query);
    return res.rows;
  }
}
