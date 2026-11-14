import "dotenv/config";
import { pool } from "../../config/database.js";
import { seedRolesAndPermissions } from "./seed-roles-permissions.js";
import { seedDatasetsAndFields } from "./seed-datasets.js";
import { seedAllRecordsAndRelationships } from "./seed-records.js";
import { verifyDatabaseSeed } from "./verify.js";

async function main() {
  console.log("=======================================================");
  console.log("          DATASCOPE DATABASE SEEDING ENGINE            ");
  console.log("          Target: 6 Datasets | 280,000 Records         ");
  console.log("=======================================================");

  const startTime = Date.now();

  try {
    // Step 1: Roles, Permissions & Seed Users
    const users = await seedRolesAndPermissions(pool);

    // Step 2: 6 Datasets & Field Definitions
    await seedDatasetsAndFields(pool, users);

    // Step 3: 280,000 Records & Cross-Dataset Relationships
    await seedAllRecordsAndRelationships(pool, users.adminUserId);

    // Step 4: Verification Suite
    const verified = await verifyDatabaseSeed(pool);

    const elapsedSeconds = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\nExecution finished in ${elapsedSeconds} seconds.`);

    if (!verified) {
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Fatal error during seeding:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
