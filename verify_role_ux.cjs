'use strict';

const path = require('path');
const http = require('http');
require(path.join(__dirname, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '.env') });
const { auth } = require(path.join(__dirname, 'dist', 'lib', 'auth.js'));

let passed = 0;
let failed = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    passed++;
    results.push(`  ✅  ${label}`);
  } else {
    failed++;
    results.push(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
  }
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const bodyStr = options.body
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : null;

    const headers = { ...(options.headers || {}) };
    if (bodyStr) {
      headers['Content-Type'] = headers['Content-Type'] || 'application/json';
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parseInt(parsed.port),
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(body); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      }
    );
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║   DataScope Role-Based Login, UX & User Management Test Suite    ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  // ─── 1. Authenticate Seeded Accounts ──────────────────────────────────────
  console.log('§1  Verifying Seeded Account Authentications');
  const [adminAuth, analystAuth, viewerAuth] = await Promise.all([
    auth.api.signInEmail({ body: { email: 'admin@datascope.local', password: 'DataScope2026!' } }),
    auth.api.signInEmail({ body: { email: 'analyst@datascope.local', password: 'DataScope2026!' } }),
    auth.api.signInEmail({ body: { email: 'viewer@datascope.local', password: 'DataScope2026!' } }),
  ]);

  assert('Administrator session generated', !!adminAuth?.token);
  assert('Data Analyst session generated', !!analystAuth?.token);
  assert('Viewer session generated', !!viewerAuth?.token);

  const adminHeaders = { Authorization: `Bearer ${adminAuth.token}`, 'Content-Type': 'application/json' };
  const analystHeaders = { Authorization: `Bearer ${analystAuth.token}`, 'Content-Type': 'application/json' };
  const viewerHeaders = { Authorization: `Bearer ${viewerAuth.token}`, 'Content-Type': 'application/json' };

  // ─── 2. Backend Role Resolution (/api/v1/auth/me) ────────────────────────
  console.log('\n§2  Dynamic Role Identification via /api/v1/auth/me');
  const [adminMe, analystMe, viewerMe] = await Promise.all([
    request('http://localhost:5001/api/v1/auth/me', { headers: adminHeaders }),
    request('http://localhost:5001/api/v1/auth/me', { headers: analystHeaders }),
    request('http://localhost:5001/api/v1/auth/me', { headers: viewerHeaders }),
  ]);

  assert('Admin /auth/me returns 200', adminMe.status === 200);
  assert('Admin role resolves dynamically as "Administrator"', adminMe.json?.user?.roleName === 'Administrator', `got ${adminMe.json?.user?.roleName}`);
  assert('Admin full name is present', !!adminMe.json?.user?.name);
  assert('Admin email matches seed', adminMe.json?.user?.email === 'admin@datascope.local');

  assert('Analyst /auth/me returns 200', analystMe.status === 200);
  assert('Analyst role resolves dynamically as "Data Analyst"', analystMe.json?.user?.roleName === 'Data Analyst', `got ${analystMe.json?.user?.roleName}`);
  assert('Analyst email matches seed', analystMe.json?.user?.email === 'analyst@datascope.local');

  assert('Viewer /auth/me returns 200', viewerMe.status === 200);
  assert('Viewer role resolves dynamically as "Viewer"', viewerMe.json?.user?.roleName === 'Viewer', `got ${viewerMe.json?.user?.roleName}`);
  assert('Viewer email matches seed', viewerMe.json?.user?.email === 'viewer@datascope.local');

  // ─── 3. Dashboard Role Boundaries (RBAC Enforcement) ──────────────────────
  console.log('\n§3  Dashboard Boundaries & RBAC Enforcement');
  // Admin console access
  const adminAdmin = await request('http://localhost:5001/api/v1/admin/overview', { headers: adminHeaders });
  assert('Administrator accesses /admin/overview → 200', adminAdmin.status === 200);

  const analystAdmin = await request('http://localhost:5001/api/v1/admin/overview', { headers: analystHeaders });
  assert('Data Analyst blocked from /admin/overview → 403', analystAdmin.status === 403);

  const viewerAdmin = await request('http://localhost:5001/api/v1/admin/overview', { headers: viewerHeaders });
  assert('Viewer blocked from /admin/overview → 403', viewerAdmin.status === 403);

  // Analyst dashboard access
  const analystAnalyst = await request('http://localhost:5001/api/v1/analyst/overview', { headers: analystHeaders });
  assert('Data Analyst accesses /analyst/overview → 200', analystAnalyst.status === 200);

  const viewerAnalyst = await request('http://localhost:5001/api/v1/analyst/overview', { headers: viewerHeaders });
  assert('Viewer blocked from /analyst/overview → 403', viewerAnalyst.status === 403);

  // Viewer dashboard access
  const viewerViewer = await request('http://localhost:5001/api/v1/viewer/overview', { headers: viewerHeaders });
  assert('Viewer accesses /viewer/overview → 200', viewerViewer.status === 200);

  // ─── 4. Administrator User Management & Safeguards ───────────────────────
  console.log('\n§4  Administrator User Management & Administrative Safeguards');
  // Fetch users list
  const usersListRes = await request('http://localhost:5001/api/v1/admin/users', { headers: adminHeaders });
  assert('GET /admin/users → 200', usersListRes.status === 200);
  assert('Users list contains seeded accounts', usersListRes.json?.data?.length >= 3);

  const rolesRes = await request('http://localhost:5001/api/v1/admin/roles', { headers: adminHeaders });
  const viewerRole = rolesRes.json?.data?.find(r => r.name === 'Viewer');
  const analystRole = rolesRes.json?.data?.find(r => r.name === 'Data Analyst');
  const adminRole = rolesRes.json?.data?.find(r => r.name === 'Administrator');

  // Test Safeguard 1: Administrator self-demotion prevention
  const selfDemoteRes = await request(`http://localhost:5001/api/v1/admin/users/${adminAuth.user.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: { roleId: viewerRole.id },
  });
  assert('Self-demotion blocked with 400 Bad Request', selfDemoteRes.status === 400);

  // Test Safeguard 2: Administrator self-deletion prevention
  const selfDeleteRes = await request(`http://localhost:5001/api/v1/admin/users/${adminAuth.user.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert('Self-deletion blocked with 400 Bad Request', selfDeleteRes.status === 400);

  // Test User Creation by Administrator
  const tempEmail = `testuser_${Date.now()}@datascope.local`;
  const createUserRes = await request('http://localhost:5001/api/v1/admin/users', {
    method: 'POST',
    headers: adminHeaders,
    body: {
      name: 'Test Managed User',
      email: tempEmail,
      password: 'DataScope2026!',
      roleId: viewerRole.id,
    },
  });
  assert('Admin creates user with credentials → 201/200', createUserRes.status === 201 || createUserRes.status === 200);
  const createdUserId = createUserRes.json?.data?.id;

  if (createdUserId) {
    // Verify newly created user can log in
    const testLogin = await auth.api.signInEmail({ body: { email: tempEmail, password: 'DataScope2026!' } });
    assert('Newly created user can authenticate with password', !!testLogin?.token);

    // Admin updates role to Data Analyst
    const updateRoleRes = await request(`http://localhost:5001/api/v1/admin/users/${createdUserId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { roleId: analystRole.id },
    });
    assert('Admin updates user role to Data Analyst → 200', updateRoleRes.status === 200);

    // Admin deactivates account (emailVerified = false)
    const deactivateRes = await request(`http://localhost:5001/api/v1/admin/users/${createdUserId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { emailVerified: false },
    });
    assert('Admin deactivates account status → 200', deactivateRes.status === 200);

    // Admin reactivates account (emailVerified = true)
    const reactivateRes = await request(`http://localhost:5001/api/v1/admin/users/${createdUserId}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: { emailVerified: true },
    });
    assert('Admin reactivates account status → 200', reactivateRes.status === 200);

    // Admin deletes user
    const deleteUserRes = await request(`http://localhost:5001/api/v1/admin/users/${createdUserId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    });
    assert('Admin deletes user account → 200', deleteUserRes.status === 200);
  }

  // ─── 5. Frontend Pages Verification (Port 3000) ───────────────────────────
  console.log('\n§5  Frontend Route Availability & Public UX (Port 3000)');
  const [loginPage, registerPage, profilePage] = await Promise.all([
    request('http://localhost:3000/login'),
    request('http://localhost:3000/register'),
    request('http://localhost:3000/profile'),
  ]);

  assert('GET /login responds 200', loginPage.status === 200);
  assert('Login page returns Next.js application shell', loginPage.body.includes('_next') || loginPage.body.includes('__NEXT_DATA__'));
  assert('Login route is served without error', loginPage.status === 200 && loginPage.body.length > 500);
  assert('Login page static chunk path present', loginPage.body.includes('/_next/static/'));
  assert('Login page does not return server error', !loginPage.body.includes('Internal Server Error'));
  assert('Login page content length indicates full shell load', loginPage.body.length > 1000);

  assert('GET /register responds 200', registerPage.status === 200);
  assert('Register page returns application shell', registerPage.body.includes('_next'));

  assert('GET /profile responds 200 or redirect', profilePage.status === 200 || profilePage.status === 302 || profilePage.status === 307);

  // ─── 6. Logout Verification ───────────────────────────────────────────────
  console.log('\n§6  Logout Invalidation');
  const logoutRes = await request('http://localhost:5001/api/v1/auth/logout', {
    method: 'POST',
    headers: viewerHeaders,
  });
  assert('POST /auth/logout → 200', logoutRes.status === 200);

  // Verify invalidated session cannot access protected endpoints
  const postLogoutMe = await request('http://localhost:5001/api/v1/auth/me', { headers: viewerHeaders });
  assert('Invalidated session returns 401 Unauthorized', postLogoutMe.status === 401, `got ${postLogoutMe.status}`);

  // ─── Final Summary ────────────────────────────────────────────────────────
  console.log('\n' + results.join('\n'));
  console.log('\n' + '─'.repeat(66));
  console.log(`  SUMMARY: Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log('─'.repeat(66) + '\n');

  if (failed === 0) {
    console.log('🎉 ALL ROLE IDENTIFICATION, LOGIN UX & USER MANAGEMENT CHECKS PASSED!\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failed} test(s) failed.\n`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('\n❌ Test execution error:', err);
  process.exit(1);
});
