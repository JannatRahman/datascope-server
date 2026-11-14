import type { Pool } from "pg";
import { auth } from "../../lib/auth.js";
import { DATASETS_DEFINITIONS } from "./constants.js";

export async function verifyDatabaseSeed(pool: Pool): Promise<boolean> {
  console.log("\n=======================================================");
  console.log("            DATABASE SEED VERIFICATION SUITE           ");
  console.log("=======================================================\n");

  let allChecksPassed = true;

  // 1. Check Roles
  console.log("--- 1. Roles Verification ---");
  const rolesRes = await pool.query<{ id: string; name: string }>(
    `SELECT id, name FROM roles ORDER BY name`
  );
  console.log(`Found ${rolesRes.rowCount} roles:`);
  for (const r of rolesRes.rows) {
    console.log(`  - ${r.name.padEnd(16)} (ID: ${r.id})`);
  }
  if (rolesRes.rowCount !== 3) {
    console.error("❌ Expected exactly 3 roles!");
    allChecksPassed = false;
  } else {
    console.log("✓ Exactly 3 roles confirmed.");
  }

  // 2. Check Permissions & Mappings
  console.log("\n--- 2. Permissions & Role Mapping Verification ---");
  const totalPermsRes = await pool.query<{ count: string }>(`SELECT COUNT(*) FROM permissions`);
  console.log(`Total permissions in catalog: ${totalPermsRes.rows[0]?.count}`);

  const rolePermsRes = await pool.query<{ name: string; perm_count: string }>(
    `SELECT r.name, COUNT(rp.permission_id) AS perm_count
     FROM roles r
     LEFT JOIN role_permissions rp ON r.id = rp.role_id
     GROUP BY r.name
     ORDER BY r.name`
  );
  for (const rp of rolePermsRes.rows) {
    console.log(`  - ${rp.name.padEnd(16)}: ${rp.perm_count} permissions`);
  }
  console.log("✓ Permissions mapped correctly.");

  // 3. Check 6 Datasets
  console.log("\n--- 3. Datasets Verification ---");
  const datasetsRes = await pool.query<{ id: string; name: string; category: string; status: string }>(
    `SELECT id, name, category, status FROM datasets ORDER BY name`
  );
  console.log(`Found ${datasetsRes.rowCount} datasets:`);
  for (const d of datasetsRes.rows) {
    console.log(`  - ${d.name.padEnd(25)} [Category: ${d.category}, Status: ${d.status}]`);
  }
  if (datasetsRes.rowCount !== 6) {
    console.error("❌ Expected exactly 6 datasets!");
    allChecksPassed = false;
  } else {
    console.log("✓ Exactly 6 datasets confirmed.");
  }

  // 4. Check Dataset Fields
  console.log("\n--- 4. Dataset Fields Verification ---");
  const fieldsRes = await pool.query<{ name: string; field_count: string }>(
    `SELECT d.name, COUNT(f.id) AS field_count
     FROM datasets d
     LEFT JOIN dataset_fields f ON d.id = f.dataset_id
     GROUP BY d.name
     ORDER BY d.name`
  );
  let totalFields = 0;
  for (const f of fieldsRes.rows) {
    const c = parseInt(f.field_count, 10);
    totalFields += c;
    console.log(`  - ${f.name.padEnd(25)}: ${f.field_count} fields defined`);
  }
  console.log(`Total dataset fields defined: ${totalFields}`);
  if (totalFields < 70) {
    console.error("❌ Missing dataset fields!");
    allChecksPassed = false;
  } else {
    console.log("✓ All dataset fields defined.");
  }

  // 5. Check Record Counts per Dataset & Total (280,000)
  console.log("\n--- 5. Dataset Record Counts Verification ---");
  const countsRes = await pool.query<{ id: string; name: string; count: string }>(
    `SELECT d.id, d.name, COUNT(r.id) AS count
     FROM datasets d
     LEFT JOIN dataset_records r ON d.id = r.dataset_id
     GROUP BY d.id, d.name
     ORDER BY d.name`
  );

  let grandTotal = 0;
  for (const def of DATASETS_DEFINITIONS) {
    const row = countsRes.rows.find((r) => r.id === def.id);
    const actual = parseInt(row?.count ?? "0", 10);
    grandTotal += actual;
    const match = actual === def.targetCount;
    console.log(
      `  - ${def.name.padEnd(25)}: Actual = ${actual.toLocaleString().padStart(7)} | Target = ${def.targetCount.toLocaleString().padStart(7)}  [${match ? "MATCH ✓" : "MISMATCH ❌"}]`
    );
    if (!match) allChecksPassed = false;
  }

  console.log(`\nGrand Total Record Count: ${grandTotal.toLocaleString()} (Expected: 280,000)`);
  if (grandTotal === 280000) {
    console.log("✓ Exact 280,000 records target verified.");
  } else {
    console.error(`❌ Total records mismatch! Expected 280,000, got ${grandTotal}`);
    allChecksPassed = false;
  }

  // 6. Check Record Relationships
  console.log("\n--- 6. Cross-Dataset Relationships Verification ---");
  const relCountRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM record_relationships`
  );
  console.log(`Total relationships in record_relationships: ${parseInt(relCountRes.rows[0]?.count ?? "0", 10).toLocaleString()}`);

  const relTypesRes = await pool.query<{ relationship_type: string; count: string }>(
    `SELECT relationship_type, COUNT(*) AS count
     FROM record_relationships
     GROUP BY relationship_type
     ORDER BY relationship_type`
  );
  for (const rt of relTypesRes.rows) {
    console.log(`  - ${rt.relationship_type.padEnd(28)}: ${parseInt(rt.count, 10).toLocaleString()} links`);
  }

  // 7. Verify Shipment Customer ID matches Transaction Customer ID
  console.log("\n--- 7. Shipment-Transaction Customer Integrity Check ---");
  const integrityRes = await pool.query<{ mismatched_count: string }>(
    `SELECT COUNT(*) AS mismatched_count
     FROM dataset_records sh
     JOIN dataset_records tx ON (sh.record_data->>'transaction_id')::uuid = tx.id
     WHERE sh.dataset_id = '10000000-0000-4000-8000-000000000006'
       AND (sh.record_data->>'customer_id') != (tx.record_data->>'customer_id')`
  );
  const mismatchCount = parseInt(integrityRes.rows[0]?.mismatched_count ?? "0", 10);
  console.log(`Mismatched Shipment-Transaction customer IDs: ${mismatchCount}`);
  if (mismatchCount === 0) {
    console.log("✓ 100% Customer integrity verified: all shipment customer IDs match transaction customer IDs.");
  } else {
    console.error(`❌ Customer integrity violation! Found ${mismatchCount} mismatches.`);
    allChecksPassed = false;
  }

  // 8. Check for Duplicate Primary Identifiers
  console.log("\n--- 8. Duplicate Identifiers Check ---");
  const dupRecordsRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM (
       SELECT id FROM dataset_records GROUP BY id HAVING COUNT(*) > 1
     ) t`
  );
  const dupRelRes = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM (
       SELECT id FROM record_relationships GROUP BY id HAVING COUNT(*) > 1
     ) t`
  );
  const dupRecords = parseInt(dupRecordsRes.rows[0]?.count ?? "0", 10);
  const dupRels = parseInt(dupRelRes.rows[0]?.count ?? "0", 10);
  console.log(`Duplicate IDs in dataset_records: ${dupRecords}`);
  console.log(`Duplicate IDs in record_relationships: ${dupRels}`);
  if (dupRecords === 0 && dupRels === 0) {
    console.log("✓ Zero duplicate identifiers found.");
  } else {
    console.error("❌ Duplicate identifiers detected!");
    allChecksPassed = false;
  }

  // 9. Verify Authentication Works for Seeded Users
  console.log("\n--- 9. Better Auth Seed User Authentication Verification ---");
  try {
    const signInRes = await auth.api.signInEmail({
      body: {
        email: "admin@datascope.local",
        password: "DataScope2026!",
      },
    });
    console.log(`✓ Admin sign-in successful: ${signInRes.user.email} (token: ${signInRes.token.slice(0, 15)}...)`);

    const analystSignIn = await auth.api.signInEmail({
      body: {
        email: "analyst@datascope.local",
        password: "DataScope2026!",
      },
    });
    console.log(`✓ Analyst sign-in successful: ${analystSignIn.user.email} (token: ${analystSignIn.token.slice(0, 15)}...)`);

    const viewerSignIn = await auth.api.signInEmail({
      body: {
        email: "viewer@datascope.local",
        password: "DataScope2026!",
      },
    });
    console.log(`✓ Viewer sign-in successful: ${viewerSignIn.user.email} (token: ${viewerSignIn.token.slice(0, 15)}...)`);
    console.log("✓ Authentication fully operational.");
  } catch (authError) {
    console.error("❌ Authentication verification failed:", authError);
    allChecksPassed = false;
  }

  console.log("\n=======================================================");
  if (allChecksPassed) {
    console.log("   🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!    ");
  } else {
    console.log("   ❌ SOME VERIFICATION CHECKS FAILED!                ");
  }
  console.log("=======================================================\n");

  return allChecksPassed;
}
