import type { Pool } from "pg";
import { DATASETS_DEFINITIONS } from "./constants.js";
import type { SeededRolesAndUsers } from "./seed-roles-permissions.js";

export async function seedDatasetsAndFields(
  pool: Pool,
  users: SeededRolesAndUsers
): Promise<void> {
  console.log("\n--- [Step 2/3] Seeding 6 Datasets, Fields & Access Memberships ---");

  let totalFieldsSeeded = 0;

  for (let dIdx = 0; dIdx < DATASETS_DEFINITIONS.length; dIdx++) {
    const d = DATASETS_DEFINITIONS[dIdx]!;

    // 1. Seed Dataset
    await pool.query(
      `INSERT INTO datasets (id, name, description, category, data_source, owner_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         category = EXCLUDED.category,
         data_source = EXCLUDED.data_source,
         owner_id = EXCLUDED.owner_id,
         status = EXCLUDED.status,
         updated_at = NOW()`,
      [
        d.id,
        d.name,
        d.description,
        d.category,
        d.dataSource,
        users.adminUserId,
        "active",
      ]
    );

    // 2. Seed Dataset Fields
    for (let fIdx = 0; fIdx < d.fields.length; fIdx++) {
      const f = d.fields[fIdx]!;
      const fieldId = `20000000-0000-4000-8000-${(dIdx + 1)
        .toString(16)
        .padStart(6, "0")}${(fIdx + 1).toString(16).padStart(6, "0")}`;

      await pool.query(
        `INSERT INTO dataset_fields (
           id, dataset_id, field_key, field_label, data_type,
           is_required, is_searchable, is_filterable, is_sortable,
           position, field_config
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (id) DO UPDATE SET
           dataset_id = EXCLUDED.dataset_id,
           field_key = EXCLUDED.field_key,
           field_label = EXCLUDED.field_label,
           data_type = EXCLUDED.data_type,
           is_required = EXCLUDED.is_required,
           is_searchable = EXCLUDED.is_searchable,
           is_filterable = EXCLUDED.is_filterable,
           is_sortable = EXCLUDED.is_sortable,
           position = EXCLUDED.position,
           field_config = EXCLUDED.field_config`,
        [
          fieldId,
          d.id,
          f.fieldKey,
          f.fieldLabel,
          f.dataType,
          f.isRequired,
          f.isSearchable,
          f.isFilterable,
          f.isSortable,
          f.position,
          JSON.stringify(f.fieldConfig ?? {}),
        ]
      );
      totalFieldsSeeded++;
    }

    // 3. Seed Dataset Memberships (RBAC access schema)
    // Administrator: manager on all datasets
    await pool.query(
      `INSERT INTO dataset_members (dataset_id, user_id, access_level, invited_by)
       VALUES ($1, $2, 'manager', $3)
       ON CONFLICT (dataset_id, user_id) DO UPDATE SET access_level = 'manager'`,
      [d.id, users.adminUserId, users.adminUserId]
    );

    // Data Analyst: editor on transactional/operational datasets, viewer on directory/supply
    const analystLevel =
      ["Customer Information", "Product Inventory", "Sales Transactions", "Shipment & Delivery"].includes(d.name)
        ? "editor"
        : "viewer";

    await pool.query(
      `INSERT INTO dataset_members (dataset_id, user_id, access_level, invited_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (dataset_id, user_id) DO UPDATE SET access_level = EXCLUDED.access_level`,
      [d.id, users.analystUserId, analystLevel, users.adminUserId]
    );

    // Viewer: viewer on all datasets
    await pool.query(
      `INSERT INTO dataset_members (dataset_id, user_id, access_level, invited_by)
       VALUES ($1, $2, 'viewer', $3)
       ON CONFLICT (dataset_id, user_id) DO UPDATE SET access_level = 'viewer'`,
      [d.id, users.viewerUserId, users.adminUserId]
    );

    console.log(`✓ Seeded dataset: "${d.name}" (${d.fields.length} fields, target: ${d.targetCount.toLocaleString()} records)`);
  }

  console.log(`✓ Seeded all 6 datasets with ${totalFieldsSeeded} total field definitions and initial RBAC memberships.`);
}
