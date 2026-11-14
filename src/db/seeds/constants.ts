export interface DatasetDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  dataSource: string;
  targetCount: number;
  fields: FieldDefinition[];
}

export interface FieldDefinition {
  fieldKey: string;
  fieldLabel: string;
  dataType: "text" | "number" | "boolean" | "date" | "email" | "url";
  isRequired: boolean;
  isSearchable: boolean;
  isFilterable: boolean;
  isSortable: boolean;
  position: number;
  fieldConfig?: Record<string, unknown>;
}

// 1. Roles
export const ROLES_LIST = [
  { name: "Administrator", description: "Platform-wide administrative access with full privileges" },
  { name: "Data Analyst", description: "Analytical data exploration, saved views, query analytics, and reporting" },
  { name: "Viewer", description: "Read-only access to assigned datasets and data views" },
] as const;

// 2. Stable Permission Identifiers across all 9 capability domains
export const PERMISSIONS_LIST = [
  // Dataset Access
  { name: "dataset:create", description: "Create new dataset schemas and tables" },
  { name: "dataset:read", description: "View dataset schemas, metadata and fields" },
  { name: "dataset:update", description: "Update dataset metadata, field configurations and schemas" },
  { name: "dataset:delete", description: "Archive or delete datasets" },
  { name: "dataset:manage_members", description: "Manage user access levels and memberships for datasets" },

  // Record Access
  { name: "record:create", description: "Insert new records into datasets" },
  { name: "record:read", description: "Query and view dataset records" },
  { name: "record:update", description: "Edit existing dataset records" },
  { name: "record:delete", description: "Delete records from datasets" },
  { name: "record:export", description: "Export records in batch formats" },

  // Search
  { name: "search:execute", description: "Execute full-text and filtered searches" },
  { name: "search:history:read", description: "View search history logs" },
  { name: "search:history:clear", description: "Clear search history" },

  // Saved Views
  { name: "saved_view:create", description: "Create personal or shared saved views" },
  { name: "saved_view:read", description: "Access saved views" },
  { name: "saved_view:update", description: "Update saved view filters, columns and sorting" },
  { name: "saved_view:delete", description: "Delete saved views" },
  { name: "saved_view:share", description: "Share saved views with team members or roles" },

  // Analytics
  { name: "analytics:view", description: "View dataset statistics and aggregate dashboards" },
  { name: "analytics:export", description: "Export analytics summaries and charts" },
  { name: "analytics:query_performance", description: "Inspect query execution performance and slow logs" },

  // Exports
  { name: "export:create", description: "Queue async dataset export jobs" },
  { name: "export:read", description: "List and inspect status of export jobs" },
  { name: "export:download", description: "Download completed export files" },
  { name: "export:cancel", description: "Cancel running or queued export jobs" },

  // User Management
  { name: "user:read", description: "View user directory and profiles" },
  { name: "user:create", description: "Provision new platform user accounts" },
  { name: "user:update", description: "Update user account details and statuses" },
  { name: "user:delete", description: "Deactivate or remove user accounts" },
  { name: "user:assign_role", description: "Assign roles to user accounts" },

  // Permissions & RBAC
  { name: "permission:read", description: "View permissions catalog" },
  { name: "permission:assign", description: "Grant or revoke permissions from roles" },
  { name: "role:read", description: "List platform roles and member counts" },
  { name: "role:manage", description: "Create or modify role definitions" },

  // System Administration
  { name: "system:settings:read", description: "View system configurations" },
  { name: "system:settings:update", description: "Modify global platform settings" },
  { name: "system:audit_logs:read", description: "View audit logs and security activity" },
  { name: "system:health:read", description: "Inspect system health, database and cache metrics" },
] as const;

// 3. Role-to-Permission Mapping
export const ROLE_PERMISSIONS_MAPPING: Record<string, string[]> = {
  Administrator: PERMISSIONS_LIST.map((p) => p.name), // All permissions
  "Data Analyst": [
    "dataset:read",
    "record:read",
    "record:export",
    "search:execute",
    "search:history:read",
    "search:history:clear",
    "saved_view:create",
    "saved_view:read",
    "saved_view:update",
    "saved_view:delete",
    "saved_view:share",
    "analytics:view",
    "analytics:export",
    "analytics:query_performance",
    "export:create",
    "export:read",
    "export:download",
  ],
  Viewer: [
    "dataset:read",
    "record:read",
    "search:execute",
    "saved_view:read",
    "export:read",
    "export:download",
  ],
};

// 4. Stable Dataset Definitions with exact counts totaling 280,000
export const DATASETS_DEFINITIONS: DatasetDefinition[] = [
  // 1. Supplier Information (5,000)
  {
    id: "10000000-0000-4000-8000-000000000005",
    name: "Supplier Information",
    description: "Approved vendors and supply chain partners providing components, raw materials, and logistics services.",
    category: "Supply Chain",
    dataSource: "SAP Procurement / Vendor Portal",
    targetCount: 5000,
    fields: [
      { fieldKey: "supplier_code", fieldLabel: "Supplier Code", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 0 },
      { fieldKey: "company_name", fieldLabel: "Company Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 1 },
      { fieldKey: "contact_name", fieldLabel: "Contact Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 2 },
      { fieldKey: "contact_email", fieldLabel: "Contact Email", dataType: "email", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 3 },
      { fieldKey: "phone", fieldLabel: "Phone", dataType: "text", isRequired: false, isSearchable: true, isFilterable: false, isSortable: false, position: 4 },
      { fieldKey: "country", fieldLabel: "Country", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 5, fieldConfig: { options: ["USA", "Germany", "Japan", "China", "UK", "Canada", "France", "South Korea", "India", "Taiwan"] } },
      { fieldKey: "city", fieldLabel: "City", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 6 },
      { fieldKey: "category", fieldLabel: "Category", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 7, fieldConfig: { options: ["Electronics", "Raw Materials", "Packaging", "Machinery", "Office Supplies", "Chemicals"] } },
      { fieldKey: "rating", fieldLabel: "Quality Rating", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 8, fieldConfig: { min: 1, max: 5, step: 0.1 } },
      { fieldKey: "is_active", fieldLabel: "Active Status", dataType: "boolean", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 9 },
      { fieldKey: "contract_start_date", fieldLabel: "Contract Start Date", dataType: "date", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 10 },
      { fieldKey: "website", fieldLabel: "Website", dataType: "url", isRequired: false, isSearchable: false, isFilterable: false, isSortable: false, position: 11 },
    ],
  },

  // 2. Employee Directory (5,000)
  {
    id: "10000000-0000-4000-8000-000000000004",
    name: "Employee Directory",
    description: "Internal corporate staff roster with departmental breakdown, reporting hierarchy, compensation, and office assignments.",
    category: "Human Resources",
    dataSource: "Workday / HRIS",
    targetCount: 5000,
    fields: [
      { fieldKey: "employee_code", fieldLabel: "Employee Code", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 0 },
      { fieldKey: "first_name", fieldLabel: "First Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 1 },
      { fieldKey: "last_name", fieldLabel: "Last Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 2 },
      { fieldKey: "email", fieldLabel: "Corporate Email", dataType: "email", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 3 },
      { fieldKey: "department", fieldLabel: "Department", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 4, fieldConfig: { options: ["Sales", "Engineering", "Marketing", "Human Resources", "Finance", "Customer Support", "Operations", "Product"] } },
      { fieldKey: "job_title", fieldLabel: "Job Title", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 5 },
      { fieldKey: "manager_id", fieldLabel: "Reports To (Manager ID)", dataType: "text", isRequired: false, isSearchable: true, isFilterable: true, isSortable: false, position: 6 },
      { fieldKey: "hire_date", fieldLabel: "Hire Date", dataType: "date", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 7 },
      { fieldKey: "salary", fieldLabel: "Annual Salary", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 8, fieldConfig: { currency: "USD", min: 40000, max: 220000 } },
      { fieldKey: "status", fieldLabel: "Employment Status", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 9, fieldConfig: { options: ["Active", "On Leave", "Terminated"] } },
      { fieldKey: "location", fieldLabel: "Office Location", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 10, fieldConfig: { options: ["New York", "San Francisco", "London", "Berlin", "Tokyo", "Singapore", "Remote"] } },
      { fieldKey: "is_account_manager", fieldLabel: "Is Account Manager", dataType: "boolean", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 11 },
    ],
  },

  // 3. Customer Information (100,000)
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Customer Information",
    description: "Enterprise and commercial customer database with contact profiles, tiers, account ownership, and revenue figures.",
    category: "CRM",
    dataSource: "Salesforce / HubSpot Sync",
    targetCount: 100000,
    fields: [
      { fieldKey: "customer_code", fieldLabel: "Customer Code", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 0 },
      { fieldKey: "company_name", fieldLabel: "Company Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 1 },
      { fieldKey: "contact_name", fieldLabel: "Contact Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 2 },
      { fieldKey: "email", fieldLabel: "Primary Email", dataType: "email", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 3 },
      { fieldKey: "phone", fieldLabel: "Phone Number", dataType: "text", isRequired: false, isSearchable: true, isFilterable: false, isSortable: false, position: 4 },
      { fieldKey: "industry", fieldLabel: "Industry", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 5, fieldConfig: { options: ["Technology", "Healthcare", "Finance", "Manufacturing", "Retail", "Education", "Telecommunications", "Energy"] } },
      { fieldKey: "tier", fieldLabel: "Customer Tier", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 6, fieldConfig: { options: ["Enterprise", "Mid-Market", "SMB", "Startup"] } },
      { fieldKey: "account_manager_id", fieldLabel: "Account Manager ID", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: false, position: 7 },
      { fieldKey: "country", fieldLabel: "Country", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 8, fieldConfig: { options: ["United States", "United Kingdom", "Germany", "Canada", "Australia", "Japan", "Netherlands", "Sweden", "France", "Switzerland"] } },
      { fieldKey: "city", fieldLabel: "City", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 9 },
      { fieldKey: "annual_revenue", fieldLabel: "Annual Revenue", dataType: "number", isRequired: false, isSearchable: false, isFilterable: true, isSortable: true, position: 10, fieldConfig: { currency: "USD" } },
      { fieldKey: "is_active", fieldLabel: "Active Status", dataType: "boolean", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 11 },
      { fieldKey: "registered_date", fieldLabel: "Registration Date", dataType: "date", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 12 },
      { fieldKey: "website", fieldLabel: "Website", dataType: "url", isRequired: false, isSearchable: false, isFilterable: false, isSortable: false, position: 13 },
    ],
  },

  // 4. Product Inventory (20,000)
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Product Inventory",
    description: "Catalog of hardware, peripherals, and electronics with inventory levels, cost, unit pricing, and supplier links.",
    category: "Inventory",
    dataSource: "ERP / Warehouse Management System",
    targetCount: 20000,
    fields: [
      { fieldKey: "sku", fieldLabel: "SKU", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 0 },
      { fieldKey: "product_name", fieldLabel: "Product Name", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 1 },
      { fieldKey: "category", fieldLabel: "Product Category", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 2, fieldConfig: { options: ["Laptops", "Smartphones", "Monitors", "Networking", "Audio", "Accessories", "Storage", "Peripherals"] } },
      { fieldKey: "supplier_id", fieldLabel: "Supplier ID", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: false, position: 3 },
      { fieldKey: "unit_price", fieldLabel: "Unit Price", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 4, fieldConfig: { currency: "USD", min: 5, max: 3500 } },
      { fieldKey: "cost_price", fieldLabel: "Cost Price", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 5, fieldConfig: { currency: "USD" } },
      { fieldKey: "stock_quantity", fieldLabel: "Stock Quantity", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 6, fieldConfig: { min: 0, max: 10000 } },
      { fieldKey: "reorder_level", fieldLabel: "Reorder Threshold", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 7 },
      { fieldKey: "status", fieldLabel: "Stock Status", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 8, fieldConfig: { options: ["In Stock", "Low Stock", "Out of Stock", "Discontinued"] } },
      { fieldKey: "warehouse_location", fieldLabel: "Warehouse Location", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: true, position: 9, fieldConfig: { options: ["Warehouse A", "Warehouse B", "Warehouse C", "Warehouse D", "Central Hub"] } },
      { fieldKey: "last_restock_date", fieldLabel: "Last Restocked", dataType: "date", isRequired: false, isSearchable: false, isFilterable: true, isSortable: true, position: 10 },
      { fieldKey: "is_discontinued", fieldLabel: "Discontinued", dataType: "boolean", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 11 },
    ],
  },

  // 5. Sales Transactions (100,000)
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Sales Transactions",
    description: "Detailed transaction ledger recording customer orders, product line items, payment methods, and reconciliations.",
    category: "Finance",
    dataSource: "Stripe / Billing Engine",
    targetCount: 100000,
    fields: [
      { fieldKey: "transaction_code", fieldLabel: "Transaction Code", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 0 },
      { fieldKey: "customer_id", fieldLabel: "Customer ID", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: false, position: 1 },
      { fieldKey: "product_id", fieldLabel: "Product ID", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: false, position: 2 },
      { fieldKey: "quantity", fieldLabel: "Order Quantity", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 3, fieldConfig: { min: 1, max: 50 } },
      { fieldKey: "unit_price", fieldLabel: "Unit Price", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 4, fieldConfig: { currency: "USD" } },
      { fieldKey: "total_amount", fieldLabel: "Total Amount", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 5, fieldConfig: { currency: "USD" } },
      { fieldKey: "discount_percent", fieldLabel: "Discount Percent", dataType: "number", isRequired: false, isSearchable: false, isFilterable: true, isSortable: true, position: 6, fieldConfig: { min: 0, max: 30 } },
      { fieldKey: "payment_status", fieldLabel: "Payment Status", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 7, fieldConfig: { options: ["Paid", "Pending", "Failed", "Refunded"] } },
      { fieldKey: "payment_method", fieldLabel: "Payment Method", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 8, fieldConfig: { options: ["Credit Card", "Wire Transfer", "ACH", "PayPal", "Net 30"] } },
      { fieldKey: "transaction_date", fieldLabel: "Transaction Date", dataType: "date", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 9 },
      { fieldKey: "channel", fieldLabel: "Sales Channel", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 10, fieldConfig: { options: ["Direct Sales", "Partner", "Online Portal", "Enterprise Contract"] } },
      { fieldKey: "is_reconciled", fieldLabel: "Reconciled Status", dataType: "boolean", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 11 },
    ],
  },

  // 6. Shipment & Delivery (50,000)
  {
    id: "10000000-0000-4000-8000-000000000006",
    name: "Shipment & Delivery",
    description: "Package fulfillment logistics tracking customer deliveries, carrier routes, statuses, and transit times.",
    category: "Logistics",
    dataSource: "ShipStation / Carrier API",
    targetCount: 50000,
    fields: [
      { fieldKey: "tracking_number", fieldLabel: "Tracking Number", dataType: "text", isRequired: true, isSearchable: true, isFilterable: false, isSortable: true, position: 0 },
      { fieldKey: "transaction_id", fieldLabel: "Transaction ID", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: false, position: 1 },
      { fieldKey: "customer_id", fieldLabel: "Customer ID", dataType: "text", isRequired: true, isSearchable: true, isFilterable: true, isSortable: false, position: 2 },
      { fieldKey: "carrier", fieldLabel: "Carrier", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 3, fieldConfig: { options: ["FedEx", "UPS", "DHL Express", "USPS", "FreightLink"] } },
      { fieldKey: "shipping_method", fieldLabel: "Shipping Method", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 4, fieldConfig: { options: ["Standard", "Express", "Overnight", "Ground", "Two-Day Air"] } },
      { fieldKey: "status", fieldLabel: "Delivery Status", dataType: "text", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 5, fieldConfig: { options: ["Delivered", "In Transit", "Out for Delivery", "Delayed", "Returned"] } },
      { fieldKey: "shipping_cost", fieldLabel: "Shipping Cost", dataType: "number", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 6, fieldConfig: { currency: "USD", min: 5, max: 150 } },
      { fieldKey: "weight_kg", fieldLabel: "Weight (kg)", dataType: "number", isRequired: false, isSearchable: false, isFilterable: true, isSortable: true, position: 7, fieldConfig: { min: 0.2, max: 45.0 } },
      { fieldKey: "shipped_date", fieldLabel: "Shipped Date", dataType: "date", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 8 },
      { fieldKey: "estimated_delivery_date", fieldLabel: "Estimated Delivery", dataType: "date", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 9 },
      { fieldKey: "actual_delivery_date", fieldLabel: "Actual Delivery", dataType: "date", isRequired: false, isSearchable: false, isFilterable: true, isSortable: true, position: 10 },
      { fieldKey: "is_signature_required", fieldLabel: "Signature Required", dataType: "boolean", isRequired: true, isSearchable: false, isFilterable: true, isSortable: true, position: 11 },
    ],
  },
];
