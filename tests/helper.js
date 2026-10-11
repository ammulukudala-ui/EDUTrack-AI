// Integration-test helper. Uses a SEPARATE database (MONGO_URI_TEST). Refuses to run on a non-test DB.
process.env.NODE_ENV = 'test';
require('dotenv').config();
const mongoose = require('mongoose');
const uri = process.env.MONGO_URI_TEST || 'mongodb://127.0.0.1:27017/edutrack_ai_test';
if (!/test/i.test(uri)) throw new Error('MONGO_URI_TEST must contain "test" so your real database is never touched.');
async function setup() {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
  await mongoose.connection.dropDatabase(); // safe: guarded above
  return require('supertest').agent(require('../server').createApp());
}
async function csrf(agent) { return (await agent.get('/api/auth/csrf')).body.token; }
module.exports = { setup, csrf, mongoose };
