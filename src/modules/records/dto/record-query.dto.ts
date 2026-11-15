export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'between'
  | 'is_null'
  | 'is_not_null';

export interface FilterRule {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface RecordQueryParams {
  page?: string | number;
  pageSize?: string | number;
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  filters?: string | FilterRule[];
  filterLogic?: 'AND' | 'OR';
}

export interface RecordListItem {
  id: string;
  datasetId: string;
  recordData: Record<string, unknown>;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedRecordsResponse {
  success: boolean;
  data: RecordListItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface RecordRelationshipItem {
  id: string;
  relationshipType: string;
  description: string | null;
  direction: 'outgoing' | 'incoming';
  relatedDatasetId: string;
  relatedDatasetName: string;
  relatedDatasetCategory: string | null;
  relatedRecordId: string;
  relatedRecordData: Record<string, unknown>;
  createdAt: string;
}
