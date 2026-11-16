import { FilterRule } from '../../records/dto/record-query.dto.js';

export interface CreateExportDto {
  format?: 'csv' | 'json';
  filters?: FilterRule[] | string;
  filterLogic?: 'AND' | 'OR';
  sortBy?: string | string[];
  sortOrder?: string | string[];
  selectedFields?: string[];
  recordIds?: string[];
}

export interface ExportJobItem {
  id: string;
  userId: string;
  userName?: string;
  datasetId: string;
  datasetName?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  format: 'csv' | 'json';
  exportConfig: Record<string, unknown>;
  filePath?: string | null;
  fileName?: string | null;
  totalRecords?: number | null;
  processedRecords?: number;
  errorMessage?: string | null;
  requestedAt: Date | string;
  startedAt?: Date | string | null;
  completedAt?: Date | string | null;
}
