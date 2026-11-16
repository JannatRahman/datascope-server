import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { AuthenticatedUser, ROLES } from '../auth/types/auth.types.js';

@Injectable()
export class PortalsService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  /**
   * Analyst Dashboard Overview
   */
  async getAnalystOverview(user: AuthenticatedUser) {
    const isMasterAdmin = user.roleName === ROLES.ADMINISTRATOR;

    // Accessible datasets query
    const datasetsQuery = `
      SELECT 
        d.id,
        d.name,
        d.category,
        COALESCE(rc.cnt, 0)::integer AS "recordCount",
        COALESCE(fc.cnt, 0)::integer AS "fieldCount",
        CASE 
          WHEN $1 = '${ROLES.ADMINISTRATOR}' THEN 'manager'
          WHEN d.owner_id = $2 THEN 'manager'
          ELSE COALESCE(dm.access_level, 'viewer')
        END AS "accessLevel"
      FROM datasets d
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_records GROUP BY dataset_id) rc ON rc.dataset_id = d.id
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_fields GROUP BY dataset_id) fc ON fc.dataset_id = d.id
      LEFT JOIN dataset_members dm ON dm.dataset_id = d.id AND dm.user_id = $2
      WHERE d.status = 'active'
        AND ($1 = '${ROLES.ADMINISTRATOR}' OR d.owner_id = $2 OR dm.user_id IS NOT NULL)
      ORDER BY d.created_at ASC
    `;

    // Recent searches
    const searchesQuery = `
      SELECT 
        sh.id,
        sh.search_query AS "searchQuery",
        sh.filters,
        sh.result_count AS "resultCount",
        sh.execution_time_ms AS "executionTimeMs",
        sh.searched_at AS "searchedAt",
        d.name AS "datasetName"
      FROM search_history sh
      LEFT JOIN datasets d ON d.id = sh.dataset_id
      WHERE sh.user_id = $1
      ORDER BY sh.searched_at DESC
      LIMIT 6
    `;

    // Saved views
    const savedViewsQuery = `
      SELECT 
        sv.id,
        sv.name,
        sv.description,
        sv.is_shared AS "isShared",
        sv.created_at AS "createdAt",
        d.name AS "datasetName",
        d.id AS "datasetId"
      FROM saved_views sv
      JOIN datasets d ON d.id = sv.dataset_id
      WHERE sv.user_id = $1 OR sv.is_shared = true
      ORDER BY sv.updated_at DESC
      LIMIT 8
    `;

    // Query performance stats for this user
    const perfQuery = `
      SELECT 
        count(*)::integer AS "totalQueries",
        COALESCE(AVG(execution_time_ms), 0)::integer AS "avgLatencyMs"
      FROM query_performance_logs
      WHERE user_id = $1
    `;

    // Recently accessed datasets derived from search history and query telemetry
    const recentDatasetsQuery = `
      SELECT
        d.id,
        d.name,
        d.description,
        d.category,
        max(access.last_seen) AS "lastAccessedAt"
      FROM (
        SELECT dataset_id, searched_at AS last_seen
        FROM search_history
        WHERE user_id = $1 AND dataset_id IS NOT NULL
        UNION ALL
        SELECT dataset_id, created_at AS last_seen
        FROM query_performance_logs
        WHERE user_id = $1 AND dataset_id IS NOT NULL
      ) access
      JOIN datasets d ON d.id = access.dataset_id
      WHERE d.status = 'active'
      GROUP BY d.id, d.name, d.description, d.category
      ORDER BY "lastAccessedAt" DESC
      LIMIT 6
    `;

    const [datasetsRes, searchesRes, savedViewsRes, perfRes, recentDatasetsRes] =
      await Promise.all([
        this.pool.query(datasetsQuery, [user.roleName, user.id]),
        this.pool.query(searchesQuery, [user.id]),
        this.pool.query(savedViewsQuery, [user.id]),
        this.pool.query(perfQuery, [user.id]),
        this.pool.query(recentDatasetsQuery, [user.id]),
      ]);

    const perf = perfRes.rows[0] ?? { totalQueries: 0, avgLatencyMs: 0 };
    const datasets = datasetsRes.rows;
    const totalAccessibleRecords = datasets.reduce((sum, d) => sum + (d.recordCount || 0), 0);

    return {
      summary: {
        accessibleDatasetsCount: datasets.length,
        totalAccessibleRecords,
        totalQueriesExecuted: perf.totalQueries,
        avgQueryLatencyMs: perf.avgLatencyMs,
        savedViewsCount: savedViewsRes.rowCount,
      },
      datasets,
      recentSearches: searchesRes.rows,
      savedViews: savedViewsRes.rows,
      recentlyAccessedDatasets: recentDatasetsRes.rows,
    };
  }

  /**
   * Viewer Dashboard Overview
   */
  async getViewerOverview(user: AuthenticatedUser) {
    // Accessible datasets query for viewer
    const datasetsQuery = `
      SELECT 
        d.id,
        d.name,
        d.description,
        d.category,
        COALESCE(rc.cnt, 0)::integer AS "recordCount",
        COALESCE(fc.cnt, 0)::integer AS "fieldCount",
        COALESCE(dm.access_level, 'viewer') AS "accessLevel"
      FROM datasets d
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_records GROUP BY dataset_id) rc ON rc.dataset_id = d.id
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_fields GROUP BY dataset_id) fc ON fc.dataset_id = d.id
      LEFT JOIN dataset_members dm ON dm.dataset_id = d.id AND dm.user_id = $2
      WHERE d.status = 'active'
        AND ($1 = '${ROLES.ADMINISTRATOR}' OR d.owner_id = $2 OR dm.user_id IS NOT NULL)
      ORDER BY d.created_at ASC
    `;

    // Shared saved views available to view
    const savedViewsQuery = `
      SELECT 
        sv.id,
        sv.name,
        sv.description,
        sv.created_at AS "createdAt",
        d.name AS "datasetName",
        d.id AS "datasetId",
        u.name AS "ownerName"
      FROM saved_views sv
      JOIN datasets d ON d.id = sv.dataset_id
      JOIN "user" u ON u.id = sv.user_id
      WHERE sv.is_shared = true OR sv.user_id = $1
      ORDER BY sv.updated_at DESC
      LIMIT 6
    `;

    const recentDatasetsQuery = `
      SELECT
        d.id,
        d.name,
        d.description,
        d.category,
        COALESCE(rc.cnt, 0)::integer AS "recordCount",
        COALESCE(fc.cnt, 0)::integer AS "fieldCount",
        max(access.last_seen) AS "lastAccessedAt"
      FROM (
        SELECT dataset_id, searched_at AS last_seen
        FROM search_history
        WHERE user_id = $1 AND dataset_id IS NOT NULL
        UNION ALL
        SELECT dataset_id, created_at AS last_seen
        FROM query_performance_logs
        WHERE user_id = $1 AND dataset_id IS NOT NULL
      ) access
      JOIN datasets d ON d.id = access.dataset_id
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_records GROUP BY dataset_id) rc ON rc.dataset_id = d.id
      LEFT JOIN (SELECT dataset_id, count(*)::integer AS cnt FROM dataset_fields GROUP BY dataset_id) fc ON fc.dataset_id = d.id
      WHERE d.status = 'active'
      GROUP BY d.id, d.name, d.description, d.category, rc.cnt, fc.cnt
      ORDER BY "lastAccessedAt" DESC
      LIMIT 6
    `;

    const recentActivityQuery = `
      SELECT 
        al.id,
        al.activity_type AS "activityType",
        al.description,
        al.entity_type AS "entityType",
        al.entity_id AS "entityId",
        al.created_at AS "createdAt"
      FROM activity_logs al
      WHERE al.user_id = $1
      ORDER BY al.created_at DESC
      LIMIT 8
    `;

    const [datasetsRes, savedViewsRes, recentDatasetsRes, recentActivityRes] = await Promise.all([
      this.pool.query(datasetsQuery, [user.roleName, user.id]),
      this.pool.query(savedViewsQuery, [user.id]),
      this.pool.query(recentDatasetsQuery, [user.id]),
      this.pool.query(recentActivityQuery, [user.id]),
    ]);

    const datasets = datasetsRes.rows;
    const totalRecords = datasets.reduce((sum, d) => sum + (d.recordCount || 0), 0);

    return {
      summary: {
        assignedDatasetsCount: datasets.length,
        totalAccessibleRecords: totalRecords,
        sharedViewsCount: savedViewsRes.rowCount,
      },
      datasets,
      sharedViews: savedViewsRes.rows,
      recentlyAccessedDatasets: recentDatasetsRes.rows,
      recentActivity: recentActivityRes.rows,
    };
  }
}
