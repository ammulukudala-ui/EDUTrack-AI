// Needs MongoDB + npm install. Covers admin student CRUD, validation, and record isolation.
const test = require('node:test'); const assert = require('node:assert');
const { setup, csrf, mongoose } = require('./helper');
const bcrypt = require('bcrypt'); const User = require('../models/User');
let agent, tok;
const login = async (email, password) => { tok = await csrf(agent); const r = await agent.post('/api/auth/login').set('X-CSRF-Token', tok).send({ email, password }); tok = r.body.token; return r; };

test.before(async () => {
  agent = await setup();
  await User.create({ name: 'Admin', email: 'a@test.example', role: 'admin', passwordHash: await bcrypt.hash('Admin@1234', 4) });
});
test.after(async () => { await mongoose.disconnect(); });

test('admin student CRUD + safe delete', async () => {
  assert.strictEqual((await login('a@test.example', 'Admin@1234')).status, 200);
  const body = { name: 'Stu One', email: 's1@test.example', password: 'Passw0rd1', studentId: 'S1', department: 'CS', semester: 5, year: 3 };
  const c = await agent.post('/api/students').set('X-CSRF-Token', tok).send(body); assert.strictEqual(c.status, 201);
  const id = c.body.data._id;
  assert.strictEqual((await agent.post('/api/students').set('X-CSRF-Token', tok).send({ ...body, email: 'x@test.example' })).status, 409); // duplicate student ID
  assert.strictEqual((await agent.get('/api/students?q=Stu')).body.data.length, 1);
  assert.strictEqual((await agent.put(`/api/students/${id}`).set('X-CSRF-Token', tok).send({ semester: 6 })).body.data.semester, 6);
  assert.strictEqual((await agent.get('/api/students/not-an-id')).status, 422);
  assert.strictEqual((await agent.delete(`/api/students/${id}`).set('X-CSRF-Token', tok)).body.deleted, true);
});
test('student cannot read another student', async () => {
  const mk = (n) => agent.post('/api/students').set('X-CSRF-Token', tok).send({ name: 'S' + n, email: `s${n}@test.example`, password: 'Passw0rd1', studentId: 'ST' + n, department: 'CS', semester: 5, year: 3 });
  const a = await mk(10), b = await mk(11);
  await login('s10@test.example', 'Passw0rd1');
  assert.strictEqual((await agent.get(`/api/students/${b.body.data._id}`)).status, 403);
  assert.strictEqual((await agent.get(`/api/students/${a.body.data._id}`)).status, 200);
});
