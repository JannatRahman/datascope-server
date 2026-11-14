import type { Pool } from "pg";
import { auth } from "../../lib/auth.js";
import {
  ROLES_LIST,
  PERMISSIONS_LIST,
  ROLE_PERMISSIONS_MAPPING,
} from "./constants.js";

export interface SeededRolesAndUsers {
  rolesMap: Map<string, string>; // roleName -> roleId
  adminUserId: string;
  analystUserId: string;
  viewerUserId: string;
}

export async function seedRolesAndPermissions(pool: Pool): Promise<SeededRolesAndUsers> {
  console.log("\n--- [Step 1/3] Seeding Roles, Permissions & Seed Users ---");

  // 1. Seed Roles
  const rolesMap = new Map<string, string>();
  for (const role of ROLES_LIST) {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO roles (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [role.name, role.description]
    );
    const row = res.rows[0];
    if (row) {
      rolesMap.set(role.name, row.id);
    }
  }
  console.log(`✓ Seeded ${rolesMap.size} roles: ${Array.from(rolesMap.keys()).join(", ")}`);

  // 2. Seed Permissions
  const permissionsMap = new Map<string, string>();
  for (const perm of PERMISSIONS_LIST) {
    const res = await pool.query<{ id: string }>(
      `INSERT INTO permissions (name, description)
       VALUES ($1, $2)
       ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
       RETURNING id`,
      [perm.name, perm.description]
    );
    const row = res.rows[0];
    if (row) {
      permissionsMap.set(perm.name, row.id);
    }
  }
  console.log(`✓ Seeded ${permissionsMap.size} stable permissions`);

  // 3. Seed Role-Permissions mappings
  let rolePermCount = 0;
  for (const [roleName, permNames] of Object.entries(ROLE_PERMISSIONS_MAPPING)) {
    const roleId = rolesMap.get(roleName);
    if (!roleId) continue;

    for (const permName of permNames) {
      const permId = permissionsMap.get(permName);
      if (!permId) continue;

      await pool.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_id) DO NOTHING`,
        [roleId, permId]
      );
      rolePermCount++;
    }
  }
  console.log(`✓ Mapped ${rolePermCount} role-permission relationships`);

  // 4. Seed Platform Users (Admin, Analyst, Viewer)
  const defaultUsers = [
    { email: "admin@datascope.local", name: "System Administrator", roleName: "Administrator" },
    { email: "analyst@datascope.local", name: "Senior Data Analyst", roleName: "Data Analyst" },
    { email: "viewer@datascope.local", name: "General Viewer", roleName: "Viewer" },
  ];

  const userIds: Record<string, string> = {};

  for (const u of defaultUsers) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM "user" WHERE email = $1`,
      [u.email]
    );

    let userId: string;
    if (existing.rows.length > 0 && existing.rows[0]) {
      userId = existing.rows[0].id;
    } else {
      // Register with Better Auth
      const reg = await auth.api.signUpEmail({
        body: {
          email: u.email,
          password: "DataScope2026!",
          name: u.name,
        },
      });
      userId = reg.user.id;
    }

    // Set role_id directly on user row
    const roleId = rolesMap.get(u.roleName);
    if (roleId) {
      await pool.query(
        `UPDATE "user" SET role_id = $1 WHERE id = $2`,
        [roleId, userId]
      );
    }

    userIds[u.roleName] = userId;
  }

  const adminUserId = userIds["Administrator"]!;
  const analystUserId = userIds["Data Analyst"]!;
  const viewerUserId = userIds["Viewer"]!;

  console.log(`✓ Verified seed platform users:`);
  console.log(`  - Admin:   admin@datascope.local (ID: ${adminUserId})`);
  console.log(`  - Analyst: analyst@datascope.local (ID: ${analystUserId})`);
  console.log(`  - Viewer:  viewer@datascope.local (ID: ${viewerUserId})`);

  return {
    rolesMap,
    adminUserId,
    analystUserId,
    viewerUserId,
  };
}
