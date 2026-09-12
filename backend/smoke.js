// Self-check for both roles. Run with the server up: node smoke.js
const assert = require('assert');
const base = process.env.API || 'http://localhost:3000/api';
const session = () => { let cookie = ''; return async (method, path, body) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', cookie }, body: body && JSON.stringify(body) });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, body: await r.json().catch(() => null) };
}; };
(async () => {
  const admin = session(), fm = session();
  assert.equal((await admin('GET', '/state')).status, 401, 'state must require login');
  assert.equal((await admin('POST', '/login', { username: 'admin', password: 'wrong' })).status, 401, 'bad password rejected');
  assert.equal((await admin('POST', '/login', { username: 'admin', password: 'admin' })).body.role, 'admin', 'admin login');
  const s = (await admin('GET', '/state')).body;
  assert.ok(s.foremen.length >= 28 && s.labourers.length >= 800, 'seed data present');
  assert.deepEqual(s.users.map(u => u.username).sort(), ['admin', 'foreman'], 'exactly two logins');
  const fid = s.foremen[0].id;

  // shared foreman login
  assert.equal((await fm('POST', '/login', { username: 'foreman', password: 'foreman' })).body.role, 'foreman', 'foreman login');
  assert.equal((await fm('GET', '/users')).status, 403, 'foreman cannot list users');
  assert.equal((await fm('GET', '/backup')).status, 403, 'foreman cannot backup');
  assert.equal((await fm('POST', '/master/drivers', { id: 'SMOKE_D', name: 'Smoke' })).status, 201, 'foreman CAN edit masters');
  assert.equal((await fm('DELETE', '/master/drivers/SMOKE_D')).status, 200, 'foreman CAN delete masters');
  const created = (await fm('POST', '/reports', { foremanId: fid, date: '2000-01-02', status: 'Accepted', labourRows: [{ labourId: s.labourers[0].id, attendance: 'Absent' }], vehicleBlocks: [], binRows: [] })).body;
  assert.equal(created.foremanId, fid, 'foreman picks name'); assert.equal(created.status, 'Draft', 'foreman cannot self-accept');
  assert.equal((await fm('PUT', `/reports/${created.id}`, { status: 'Sent' })).body.status, 'Sent', 'foreman submits');
  assert.equal((await fm('PUT', `/reports/${created.id}/review`, { status: 'Accepted' })).status, 403, 'foreman cannot review');

  // admin reviews
  const rej = (await admin('PUT', `/reports/${created.id}/review`, { status: 'Rejected', note: 'fix bins' })).body;
  assert.equal(rej.status, 'Rejected'); assert.equal(rej.reviewNote, 'fix bins');
  assert.equal((await fm('PUT', `/reports/${created.id}`, { status: 'Sent' })).body.status, 'Sent', 'foreman resubmits after rejection');
  assert.equal((await admin('PUT', `/reports/${created.id}/review`, { status: 'Accepted' })).body.status, 'Accepted');
  assert.equal((await fm('PUT', `/reports/${created.id}`, { shiftEnd: '16:00' })).status, 403, 'accepted report frozen for foreman');
  assert.equal((await fm('DELETE', `/reports/${created.id}`)).status, 403, 'accepted report cannot be deleted by foreman');
  await admin('DELETE', `/reports/${created.id}`);
  assert.ok(!(await admin('GET', '/state')).body.reports.some(r => r.id === created.id), 'admin deleted report');

  // users
  assert.equal((await admin('POST', '/users', { username: 'smoke_user', password: 'pw', role: 'foreman' })).status, 201);
  assert.equal((await session()('POST', '/login', { username: 'smoke_user', password: 'pw' })).body.role, 'foreman', 'new user logs in');
  await admin('DELETE', '/users/smoke_user');
  assert.equal((await session()('POST', '/login', { username: 'smoke_user', password: 'pw' })).status, 401, 'deleted user cannot log in');
  console.log('smoke OK');
})().catch(e => { console.error('smoke FAILED:', e.message); process.exit(1); });
