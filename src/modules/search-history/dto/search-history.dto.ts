export interface RecordSearchDto {
  datasetId?: string;
  searchQuery: string;
  filters?: Record<string, unknown> | unknown[];
  sortConfig?: Record<string, unknown> | unknown[];
  resultCount?: number;
  executionTimeMs?: number;
}
