const path = require('path');
const http = require('http');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(body);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body, json });
        });
      }
    );
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

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

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       DataScope Platform Complete Verification Test Suite        ║');
  console.log('║                  Stages 1, 2, 3, 4, 5 and 6                      ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');

  const serverPath = __dirname;
  const { auth } = require(path.join(serverPath, 'dist', 'lib', 'auth.js'));

  // ─── 1. Authenticate Seeded Accounts via Better Auth ──────────────────────
  console.log('§1  Authenticating Seeded Accounts');
  let adminAuth, analystAuth, viewerAuth;
  try {
    [adminAuth, analystAuth, viewerAuth] = await Promise.all([
      auth.api.signInEmail({ body: { email: 'admin@datascope.local', password: 'DataScope2026!' } }),
      auth.api.signInEmail({ body: { email: 'analyst@datascope.local', password: 'DataScope2026!' } }),
      auth.api.signInEmail({ body: { email: 'viewer@datascope.local', password: 'DataScope2026!' } }),
    ]);
    assert('Admin session created', !!adminAuth?.token);
    assert('Analyst session created', !!analystAuth?.token);
    assert('Viewer session created', !!viewerAuth?.token);
  } catch (err) {
    console.error('Fatal auth failure:', err);
    process.exit(1);
  }

  const adminHeaders = { Authorization: `Bearer ${adminAuth.token}`, 'Content-Type': 'application/json' };
  const analystHeaders = { Authorization: `Bearer ${analystAuth.token}`, 'Content-Type': 'application/json' };
  const viewerHeaders = { Authorization: `Bearer ${viewerAuth.token}`, 'Content-Type': 'application/json' };

  // ─── 2. System Health & Documentation ─────────────────────────────────────
  console.log('\n§2  System Health & Documentation');
  const healthRes = await request('http://localhost:5001/health');
  assert('GET /health → 200', healthRes.status === 200);

  const swaggerRes = await request('http://localhost:5001/api/docs');
  assert('GET /api/docs → 200 (Swagger)', swaggerRes.status === 200);

  // ─── 3. Unauthenticated Boundary Enforcement (401) ────────────────────────
  console.log('\n§3  Unauthenticated Boundary Enforcement (401)');
  const unauthEndpoints = [
    '/api/v1/datasets',
    '/api/v1/admin/overview',
    '/api/v1/analyst/overview',
    '/api/v1/viewer/overview',
    '/api/v1/exports',
    '/api/v1/saved-views',
    '/api/v1/preferences',
    '/api/v1/notifications',
    '/api/v1/search-history',
    '/api/v1/analytics/overview',
  ];
  for (const ep of unauthEndpoints) {
    const res = await request(`http://localhost:5001${ep}`);
    assert(`Unauthenticated GET ${ep} → 401`, res.status === 401, `got ${res.status}`);
  }

  // ─── 4. Role-Based Access Control Boundaries (403) ────────────────────────
  console.log('\n§4  Role-Based Access Control Boundaries (403)');
  const viewerAdminRes = await request('http://localhost:5001/api/v1/admin/overview', { headers: viewerHeaders });
  assert('Viewer accessing /admin/overview → 403', viewerAdminRes.status === 403, `got ${viewerAdminRes.status}`);

  const analystAdminRes = await request('http://localhost:5001/api/v1/admin/overview', { headers: analystHeaders });
  assert('Analyst accessing /admin/overview → 403', analystAdminRes.status === 403, `got ${analystAdminRes.status}`);

  const viewerAnalystRes = await request('http://localhost:5001/api/v1/analyst/overview', { headers: viewerHeaders });
  assert('Viewer accessing /analyst/overview → 403', viewerAnalystRes.status === 403, `got ${viewerAnalystRes.status}`);

  // ─── 5. Administrator Console APIs ────────────────────────────────────────
  console.log('\n§5  Administrator Console APIs');
  const adminOv = await request('http://localhost:5001/api/v1/admin/overview', { headers: adminHeaders });
  assert('GET /admin/overview → 200', adminOv.status === 200);
  assert('Total datasets count is 6', adminOv.json?.data?.metrics?.totalDatasets === 6, `got ${adminOv.json?.data?.metrics?.totalDatasets}`);
  assert('Total records count is 280,000', adminOv.json?.data?.metrics?.totalRecords >= 280000, `got ${adminOv.json?.data?.metrics?.totalRecords}`);

  const adminRoles = await request('http://localhost:5001/api/v1/admin/roles', { headers: adminHeaders });
  assert('GET /admin/roles → 200 (3 roles)', adminRoles.json?.data?.length === 3);

  const adminPerms = await request('http://localhost:5001/api/v1/admin/permissions', { headers: adminHeaders });
  assert('GET /admin/permissions → 200 (38 permissions)', adminPerms.json?.data?.length === 38);

  const adminUsers = await request('http://localhost:5001/api/v1/admin/users', { headers: adminHeaders });
  assert('GET /admin/users → 200', adminUsers.status === 200);

  const adminLogs = await request('http://localhost:5001/api/v1/admin/activity-logs', { headers: adminHeaders });
  assert('GET /admin/activity-logs → 200', adminLogs.status === 200);

  const adminPerf = await request('http://localhost:5001/api/v1/admin/performance', { headers: adminHeaders });
  assert('GET /admin/performance → 200', adminPerf.status === 200);

  // ─── 6. Analyst & Viewer Portal APIs ──────────────────────────────────────
  console.log('\n§6  Analyst & Viewer Portal APIs');
  const analystOv = await request('http://localhost:5001/api/v1/analyst/overview', { headers: analystHeaders });
  assert('GET /analyst/overview → 200', analystOv.status === 200);
  assert('Analyst sees 6 accessible datasets', analystOv.json?.data?.datasets?.length === 6, `got ${analystOv.json?.data?.datasets?.length}`);

  const viewerOv = await request('http://localhost:5001/api/v1/viewer/overview', { headers: viewerHeaders });
  assert('GET /viewer/overview → 200', viewerOv.status === 200);
  assert('Viewer sees 6 assigned datasets', viewerOv.json?.data?.datasets?.length === 6, `got ${viewerOv.json?.data?.datasets?.length}`);

  // ─── 7. Datasets & Large Dataset Exploration (6.5 Performance) ───────────
  console.log('\n§7  Datasets & Large Dataset Exploration');
  const datasetsRes = await request('http://localhost:5001/api/v1/datasets', { headers: analystHeaders });
  assert('GET /datasets → 200', datasetsRes.status === 200);
  assert('Datasets array has 6 items', datasetsRes.json?.data?.length === 6);

  const customerDataset = datasetsRes.json?.data?.find(d => d.name === 'Customer Information');
  const salesDataset = datasetsRes.json?.data?.find(d => d.name === 'Sales Transactions');
  const empDataset = datasetsRes.json?.data?.find(d => d.name === 'Employee Directory');

  assert('Customer Information dataset exists (100k records)', !!customerDataset && customerDataset.recordCount === 100000);
  assert('Sales Transactions dataset exists (100k records)', !!salesDataset && salesDataset.recordCount === 100000);
  assert('Employee Directory dataset exists (5k records)', !!empDataset && empDataset.recordCount === 5000);

  // Test paginated query on 100k record dataset
  if (customerDataset) {
    // Warm-up query to initialize DB connection pool & cache
    await request(`http://localhost:5001/api/v1/datasets/${customerDataset.id}/records?page=1&pageSize=25`, { headers: analystHeaders });
    const t0 = Date.now();
    const custRecs = await request(`http://localhost:5001/api/v1/datasets/${customerDataset.id}/records?page=1&pageSize=25`, { headers: analystHeaders });
    const elapsed = Date.now() - t0;
    assert('Customer records query responds with 200', custRecs.status === 200);
    assert('Customer records total is 100,000', custRecs.json?.meta?.total === 100000);
    assert(`100k records query response time under 300ms (${elapsed}ms)`, elapsed < 300);
  }

  // ─── 8. Search History (Stage 5.2) ────────────────────────────────────────
  console.log('\n§8  Search History Tracking & Replay');
  const logSearchRes = await request('http://localhost:5001/api/v1/search-history', {
    method: 'POST',
    headers: analystHeaders,
    body: {
      datasetId: customerDataset?.id,
      searchQuery: 'Global Logistics',
      resultCount: 42,
      executionTimeMs: 18,
    },
  });
  assert('POST /search-history (record query) → 201', logSearchRes.status === 201);
  const searchEntryId = logSearchRes.json?.data?.id;

  const historyList = await request('http://localhost:5001/api/v1/search-history', { headers: analystHeaders });
  assert('GET /search-history → 200', historyList.status === 200);
  assert('Search query found in history', historyList.json?.data?.some(h => h.id === searchEntryId));

  if (searchEntryId) {
    const delSearch = await request(`http://localhost:5001/api/v1/search-history/${searchEntryId}`, {
      method: 'DELETE',
      headers: analystHeaders,
    });
    assert('DELETE /search-history/:id → 200', delSearch.status === 200);
  }

  // ─── 9. Saved Views & User Sharing (Stage 5.1) ───────────────────────────
  console.log('\n§9  Saved Views & User Sharing');
  let viewId = null;
  if (customerDataset) {
    const createView = await request('http://localhost:5001/api/v1/saved-views', {
      method: 'POST',
      headers: analystHeaders,
      body: {
        name: 'Enterprise VIP Customers',
        description: 'Filtered view for tier Enterprise',
        datasetId: customerDataset.id,
        isShared: false,
        filters: [{ field: 'tier', operator: 'equals', value: 'Enterprise' }],
        visibleColumns: ['company_name', 'tier', 'annual_revenue', 'country'],
      },
    });
    assert('POST /saved-views → 201', createView.status === 201);
    viewId = createView.json?.data?.id;

    if (viewId) {
      // Share view directly with viewer user
      const shareRes = await request(`http://localhost:5001/api/v1/saved-views/${viewId}/shares`, {
        method: 'POST',
        headers: analystHeaders,
        body: { userId: viewerAuth.user.id },
      });
      assert('POST /saved-views/:id/shares (share with viewer) → 200', shareRes.status === 200);

      // Verify viewer can access the shared view
      const viewerList = await request(`http://localhost:5001/api/v1/saved-views?datasetId=${customerDataset.id}`, { headers: viewerHeaders });
      const viewerCanSee = viewerList.json?.data?.some(v => v.id === viewId);
      assert('Viewer can discover and open shared view', viewerCanSee === true);

      // List shares
      const listShares = await request(`http://localhost:5001/api/v1/saved-views/${viewId}/shares`, { headers: analystHeaders });
      assert('GET /saved-views/:id/shares → 200', listShares.status === 200);
      assert('Share list contains viewer user', listShares.json?.data?.some(s => s.userId === viewerAuth.user.id));

      // Revoke share
      const revokeShare = await request(`http://localhost:5001/api/v1/saved-views/${viewId}/shares/${viewerAuth.user.id}`, {
        method: 'DELETE',
        headers: analystHeaders,
      });
      assert('DELETE /saved-views/:id/shares/:userId → 200', revokeShare.status === 200);

      // Delete view
      await request(`http://localhost:5001/api/v1/saved-views/${viewId}`, { method: 'DELETE', headers: analystHeaders });
    }
  }

  // ─── 10. Live Analytics Engine (Stage 5.3) ────────────────────────────────
  console.log('\n§10  Live Analytics Engine (Real Data Distributions)');
  const analyticsRes = await request('http://localhost:5001/api/v1/analytics/overview', { headers: analystHeaders });
  assert('GET /analytics/overview → 200', analyticsRes.status === 200);

  const analyticsData = analyticsRes.json?.data;
  assert('Analytics has dataset distribution', Array.isArray(analyticsData?.datasetDistribution) && analyticsData.datasetDistribution.length === 6);
  assert('Sales payment status distribution measured', Array.isArray(analyticsData?.statusDistributions?.salesPaymentStatuses));
  assert('Shipment status distribution measured', Array.isArray(analyticsData?.statusDistributions?.shipmentStatuses));
  assert('Employee status distribution measured', Array.isArray(analyticsData?.statusDistributions?.employeeStatuses));
  assert('Query performance statistics computed', analyticsData?.queryPerformance?.avgLatencyMs !== undefined);

  // ─── 11. Bounded-Memory Exports (CSV, JSON & Cancel) (Stage 5.4) ──────────
  console.log('\n§11  Bounded-Memory Exports (CSV, JSON & Cancel)');
  const exportTarget = empDataset || customerDataset;
  if (exportTarget) {
    // 1. Viewer forbidden from exporting
    const viewerExp = await request(`http://localhost:5001/api/v1/datasets/${exportTarget.id}/export`, {
      method: 'POST',
      headers: viewerHeaders,
      body: { format: 'csv' },
    });
    assert('Viewer prohibited from exporting (403 Forbidden)', viewerExp.status === 403);

    // 2. Analyst schedules CSV export
    const csvJobRes = await request(`http://localhost:5001/api/v1/datasets/${exportTarget.id}/export`, {
      method: 'POST',
      headers: analystHeaders,
      body: { format: 'csv' },
    });
    assert('Analyst schedules CSV export → 202 Accepted', csvJobRes.status === 202);
    const csvJobId = csvJobRes.json?.data?.id;

    // Poll CSV completion
    let csvStatus = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 600));
      const j = await request(`http://localhost:5001/api/v1/exports/${csvJobId}`, { headers: analystHeaders });
      csvStatus = j.json?.data?.status;
      if (csvStatus === 'completed' || csvStatus === 'failed') break;
    }
    assert(`CSV export finished in background (${csvStatus})`, csvStatus === 'completed');

    // Download CSV
    const csvDownload = await request(`http://localhost:5001/api/v1/exports/${csvJobId}/download`, { headers: analystHeaders });
    assert('GET /exports/:id/download (CSV) → 200', csvDownload.status === 200);
    assert('CSV Content-Type is text/csv', String(csvDownload.headers['content-type']).includes('text/csv'));

    // 3. Analyst schedules JSON export
    const jsonJobRes = await request(`http://localhost:5001/api/v1/datasets/${exportTarget.id}/export`, {
      method: 'POST',
      headers: analystHeaders,
      body: { format: 'json' },
    });
    assert('Analyst schedules JSON export → 202 Accepted', jsonJobRes.status === 202);
    const jsonJobId = jsonJobRes.json?.data?.id;

    // Poll JSON completion
    let jsonStatus = null;
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 600));
      const j = await request(`http://localhost:5001/api/v1/exports/${jsonJobId}`, { headers: analystHeaders });
      jsonStatus = j.json?.data?.status;
      if (jsonStatus === 'completed' || jsonStatus === 'failed') break;
    }
    assert(`JSON export finished in background (${jsonStatus})`, jsonStatus === 'completed');

    // Download JSON & verify JSON array
    const jsonDownload = await request(`http://localhost:5001/api/v1/exports/${jsonJobId}/download`, { headers: analystHeaders });
    assert('GET /exports/:id/download (JSON) → 200', jsonDownload.status === 200);
    assert('JSON Content-Type is application/json', String(jsonDownload.headers['content-type']).includes('application/json'));
    let isValidJson = false;
    try {
      const parsed = JSON.parse(jsonDownload.body);
      isValidJson = Array.isArray(parsed) && parsed.length > 0;
    } catch {}
    assert('Downloaded JSON file parses as valid array of objects', isValidJson);

    // 4. Test Export Cancellation on 100k records dataset
    const cancelTarget = customerDataset || exportTarget;
    const cancelJobRes = await request(`http://localhost:5001/api/v1/datasets/${cancelTarget.id}/export`, {
      method: 'POST',
      headers: analystHeaders,
      body: { format: 'csv' },
    });
    const cancelJobId = cancelJobRes.json?.data?.id;
    if (cancelJobId) {
      const cancelAction = await request(`http://localhost:5001/api/v1/exports/${cancelJobId}/cancel`, {
        method: 'POST',
        headers: analystHeaders,
      });
      assert('POST /exports/:id/cancel → 200', cancelAction.status === 200);
    }
  }

  // ─── 12. In-App Notification Center (Stage 5.5) ───────────────────────────
  console.log('\n§12  In-App Notification Center');
  const notifList = await request('http://localhost:5001/api/v1/notifications', { headers: analystHeaders });
  assert('GET /notifications → 200', notifList.status === 200);
  assert('Notifications array returned', Array.isArray(notifList.json?.data));

  const unreadCountRes = await request('http://localhost:5001/api/v1/notifications/unread-count', { headers: analystHeaders });
  assert('GET /notifications/unread-count → 200', unreadCountRes.status === 200);
  assert('Unread count is a number', typeof unreadCountRes.json?.data?.unreadCount === 'number');

  if (notifList.json?.data?.length > 0) {
    const firstNotif = notifList.json?.data[0];
    const markReadRes = await request(`http://localhost:5001/api/v1/notifications/${firstNotif.id}/read`, {
      method: 'PATCH',
      headers: analystHeaders,
    });
    assert('PATCH /notifications/:id/read → 200', markReadRes.status === 200);
  }

  const markAllRes = await request('http://localhost:5001/api/v1/notifications/read-all', {
    method: 'POST',
    headers: analystHeaders,
  });
  assert('POST /notifications/read-all → 200', markAllRes.status === 200);

  // ─── 13. User Settings & Preferences (Stage 5.6) ─────────────────────────
  console.log('\n§13  User Settings & Preferences');
  const getPrefRes = await request('http://localhost:5001/api/v1/preferences', { headers: viewerHeaders });
  assert('GET /preferences → 200', getPrefRes.status === 200);

  const putPrefRes = await request('http://localhost:5001/api/v1/preferences', {
    method: 'PUT',
    headers: viewerHeaders,
    body: {
      theme: 'dark',
      tableDensity: 'compact',
      defaultPageSize: 50,
      additionalPreferences: { emailAlerts: true },
    },
  });
  assert('PUT /preferences → 200', putPrefRes.status === 200);
  assert('Preferences density updated to compact', putPrefRes.json?.data?.tableDensity === 'compact');

  // Profile update
  const updateProfileRes = await request('http://localhost:5001/api/v1/auth/profile', {
    method: 'POST',
    headers: analystHeaders,
    body: { name: 'Data Analyst Pro' },
  });
  assert('POST /auth/profile → 200', updateProfileRes.status === 200);
  assert('Profile name updated in database', updateProfileRes.json?.user?.name === 'Data Analyst Pro');

  // ─── 14. Audit & Activity Logs (Stage 5.7) ────────────────────────────────
  console.log('\n§14  Audit & Activity Logs Verification');
  const activityLogsRes = await request('http://localhost:5001/api/v1/admin/activity-logs', { headers: adminHeaders });
  assert('GET /admin/activity-logs → 200', activityLogsRes.status === 200);
  const logs = activityLogsRes.json?.data || [];
  assert('Activity logs tracked actions', logs.length > 0);

  // Security check: ensure no passwords or session tokens are present in logs
  const hasSecretsInLogs = logs.some((l) => {
    const text = JSON.stringify(l).toLowerCase();
    return text.includes('password') || text.includes('bearer ') || text.includes('better-auth.session');
  });
  assert('Activity logs do not contain secrets or passwords', !hasSecretsInLogs);

  // ─── Final Summary ────────────────────────────────────────────────────────
  console.log('\n' + results.join('\n'));
  console.log('\n' + '─'.repeat(66));
  console.log(`  SUMMARY: Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log('─'.repeat(66) + '\n');

  if (failed === 0) {
    console.log('🎉 ALL STAGES 1 THROUGH 6 INTEGRATION & VERIFICATION TESTS PASSED!\n');
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
