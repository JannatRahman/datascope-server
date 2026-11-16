export interface CreateUserDto {
  email: string;
  name: string;
  password?: string;
  roleId?: string;
}

export interface UpdateUserDto {
  name?: string;
  roleId?: string;
  emailVerified?: boolean;
}

export interface UpdateRolePermissionsDto {
  permissionIds: string[];
}

export interface AddDatasetMemberDto {
  userId: string;
  accessLevel: 'viewer' | 'editor' | 'manager';
}

export type DatasetFieldDataType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'email'
  | 'url';

export interface CreateDatasetFieldDto {
  fieldKey: string;
  fieldLabel: string;
  dataType?: DatasetFieldDataType;
  isRequired?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  isSortable?: boolean;
  position?: number;
  fieldConfig?: Record<string, unknown>;
}

export interface UpdateDatasetFieldDto {
  fieldKey?: string;
  fieldLabel?: string;
  dataType?: DatasetFieldDataType;
  isRequired?: boolean;
  isSearchable?: boolean;
  isFilterable?: boolean;
  isSortable?: boolean;
  position?: number;
  fieldConfig?: Record<string, unknown>;
}

export interface CreateDatasetDto {
  name: string;
  description?: string;
  category?: string;
  dataSource?: string;
  status?: 'active' | 'archived';
  fields?: CreateDatasetFieldDto[];
}

export interface UpdateDatasetDto {
  name?: string;
  description?: string;
  category?: string;
  dataSource?: string;
  status?: 'active' | 'archived';
}

export interface GenerateDatasetRecordsDto {
  count?: number;
  clearExisting?: boolean;
}

export interface ImportDatasetRecordsDto {
  records: Record<string, unknown>[];
  clearExisting?: boolean;
}

export interface UpdateSharedViewDto {
  isShared?: boolean;
}

export interface UpdateSystemSettingsDto {
  platformName?: string;
  supportEmail?: string;
  timezone?: string;
  dateFormat?: string;
  defaultPageSize?: number;
  maxPageSize?: number;
  cacheEnabled?: boolean;
  cacheTtlSeconds?: number;
  searchMinLength?: number;
  searchMaxResults?: number;
  allowUserRegistration?: boolean;
  maintenanceMode?: boolean;
  sessionTimeoutMinutes?: number;
}
