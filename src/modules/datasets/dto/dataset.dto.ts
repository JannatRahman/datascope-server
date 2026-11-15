export interface DatasetListItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  dataSource: string | null;
  status: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  recordCount: number;
  fieldCount: number;
  accessLevel: "viewer" | "editor" | "manager";
}

export interface DatasetFieldItem {
  id: string;
  datasetId: string;
  fieldKey: string;
  fieldLabel: string;
  dataType: "text" | "number" | "boolean" | "date" | "email" | "url";
  isRequired: boolean;
  isSearchable: boolean;
  isFilterable: boolean;
  isSortable: boolean;
  position: number;
  fieldConfig: Record<string, unknown>;
}
