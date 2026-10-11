// Needs MongoDB + npm install. Dashboard analytics + missing-data handling for a brand-new student.
const test = require('node:test'); const assert = require('node:assert');
const { setup, csrf, mongoose } = require('./helper');
let agent;
test.before(async () => { agent = await setup(); });
test.after(async () => { await mongoose.disconnect(); });

test('new student: dashboard has no fake numbers, risk is "insufficient"', async () => {
  let t = await csrf(agent);
  const r = await agent.post('/api/auth/register').set('X-CSRF-Token', t).send({ name: 'New Kid', email: 'nk@test.example', studentId: 'NK1', department: 'CS', semester: 5, year: 3, password: 'Passw0rd1', confirmPassword: 'Passw0rd1' });
  assert.strictEqual(r.status, 201);
  const d = (await agent.get('/api/analytics/dashboard')).body.data;
  assert.strictEqual(d.overallAverage, null); assert.strictEqual(d.overallAttendance, null); assert.deepStrictEqual(d.subjectPerformance, []);
  const risk = (await agent.get('/api/risk/my-assessment')).body.data;
  assert.strictEqual(risk.status, 'insufficient'); assert.strictEqual(risk.score, null);
});
test('unauthenticated analytics -> 401; bad filter -> 422', async () => {
  const fresh = require('supertest').agent(require('../server').createApp());
  assert.strictEqual((await fresh.get('/api/analytics/dashboard')).status, 401);
  assert.strictEqual((await agent.get('/api/analytics/dashboard?from=garbage')).status, 422);
});
