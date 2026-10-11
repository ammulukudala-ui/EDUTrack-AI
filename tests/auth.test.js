// Needs MongoDB running + `npm install`. Run: npm test
const test = require('node:test'); const assert = require('node:assert');
const { setup, csrf, mongoose } = require('./helper');
const User = require('../models/User'); const bcrypt = require('bcrypt');
let agent; const u = { name: 'Test Student', email: 'ts@test.example', studentId: 'T1', department: 'CS', semester: 5, year: 3, password: 'Passw0rd!', confirmPassword: 'Passw0rd!' };

test.before(async () => { agent = await setup(); });
test.after(async () => { await mongoose.disconnect(); });

test('MongoDB connection is ready', () => assert.strictEqual(mongoose.connection.readyState, 1));
test('register rejects request without CSRF token', async () => assert.strictEqual((await agent.post('/api/auth/register').send(u)).status, 403));
test('register creates student, hashes password, hides hash', async () => {
  const t = await csrf(agent);
  const r = await agent.post('/api/auth/register').set('X-CSRF-Token', t).send({ ...u, role: 'admin' });
  assert.strictEqual(r.status, 201); assert.strictEqual(r.body.user.role, 'student'); assert.strictEqual(r.body.user.passwordHash, undefined);
  const db = await User.findOne({ email: u.email }).select('+passwordHash');
  assert.notStrictEqual(db.passwordHash, u.password); assert.ok(await bcrypt.compare(u.password, db.passwordHash));
});
test('duplicate email -> 409', async () => {
  const t = await csrf(agent);
  assert.strictEqual((await agent.post('/api/auth/register').set('X-CSRF-Token', t).send({ ...u, studentId: 'T2' })).status, 409);
});
test('logout then protected route -> 401; login works; wrong password -> 401', async () => {
  let t = await csrf(agent); await agent.post('/api/auth/logout').set('X-CSRF-Token', t);
  assert.strictEqual((await agent.get('/api/auth/me')).status, 401);
  t = await csrf(agent);
  assert.strictEqual((await agent.post('/api/auth/login').set('X-CSRF-Token', t).send({ email: u.email, password: 'wrong' })).status, 401);
  const ok = await agent.post('/api/auth/login').set('X-CSRF-Token', t).send({ email: u.email, password: u.password });
  assert.strictEqual(ok.status, 200);
});
test('student cannot use admin APIs', async () => {
  assert.strictEqual((await agent.get('/api/admin/stats')).status, 403);
  const t = await csrf(agent);
  assert.strictEqual((await agent.post('/api/students').set('X-CSRF-Token', t).send({})).status, 403);
});
