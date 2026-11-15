import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../../core/constants.js';
import { ROLES, AuthenticatedUser } from '../auth/types/auth.types.js';
import { RecordSearchDto } from './dto/search-history.dto.js';

@Injectable()
export class SearchHistoryService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
  ) {}

  /**
   * List recent search history for current user.
   */
  async findAll(user: AuthenticatedUser, datasetId?: string) {
    const params: unknown[] = [user.id];
    let datasetFilter = '';
    if (datasetId) {
      params.push(datasetId);
      datasetFilter = `AND sh.dataset_id = $2`;
    }

    const query = `
      SELECT 
        sh.id,
        sh.user_id AS "userId",
        sh.dataset_id AS "datasetId",
        d.name AS "datasetName",
        sh.search_query AS "searchQuery",
        sh.filters,
        sh.sort_config AS "sortConfig",
        sh.result_count AS "resultCount",
        sh.execution_time_ms AS "executionTimeMs",
        sh.searched_at AS "searchedAt"
      FROM search_history sh
      LEFT JOIN datasets d ON d.id = sh.dataset_id
      WHERE sh.user_id = $1
        ${datasetFilter}
      ORDER BY sh.searched_at DESC
      LIMIT 100;
    `;

    const res = await this.pool.query(query, params);
    return res.rows;
  }

  /**
   * Log/record a search query into search history.
   */
  async recordSearch(user: AuthenticatedUser, dto: RecordSearchDto) {
    if (!dto.searchQuery || dto.searchQuery.trim().length === 0) {
      return null;
    }

    const query = `
      INSERT INTO search_history (
        user_id,
        dataset_id,
        search_query,
        filters,
        sort_config,
        result_count,
        execution_time_ms,
        searched_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING 
        id,
        user_id AS "userId",
        dataset_id AS "datasetId",
        search_query AS "searchQuery",
        filters,
        sort_config AS "sortConfig",
        result_count AS "resultCount",
        execution_time_ms AS "executionTimeMs",
        searched_at AS "searchedAt";
    `;

    const res = await this.pool.query(query, [
      user.id,
      dto.datasetId ?? null,
      dto.searchQuery.trim(),
      JSON.stringify(dto.filters ?? {}),
      JSON.stringify(dto.sortConfig ?? {}),
      dto.resultCount ?? 0,
      dto.executionTimeMs ?? 0,
    ]);

    return res.rows[0];
  }

  /**
   * Delete single search history entry.
   */
  async deleteEntry(id: string, user: AuthenticatedUser) {
    const existing = await this.pool.query('SELECT user_id FROM search_history WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new NotFoundException('Search history entry not found');
    }

    if (existing.rows[0].user_id !== user.id && user.roleName !== ROLES.ADMINISTRATOR) {
      throw new ForbiddenException('You can only delete your own search history');
    }

    await this.pool.query('DELETE FROM search_history WHERE id = $1', [id]);
    return { success: true, message: 'Search history entry deleted' };
  }

  /**
   * Clear all search history for the user.
   */
  async clearAll(user: AuthenticatedUser) {
    await this.pool.query('DELETE FROM search_history WHERE user_id = $1', [user.id]);
    return { success: true, message: 'All search history cleared' };
  }
}
