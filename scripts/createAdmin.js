// Creates the FIRST administrator safely. Run:  npm run create-admin
// Reads ADMIN_NAME / ADMIN_EMAIL / ADMIN_PASSWORD from .env (or asks you to type them).
require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');

const ask = (q) => new Promise((res) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); rl.question(q, (a) => { rl.close(); res(a.trim()); }); });

(async () => {
  await connectDB();
  const name = process.env.ADMIN_NAME || (await ask('Admin name: '));
  const email = (process.env.ADMIN_EMAIL || (await ask('Admin email: '))).toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (await ask('Admin password (min 8, upper+lower+number): '));
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) { console.error('Password too weak.'); process.exit(1); }
  if (await User.exists({ email })) { console.log(`A user with ${email} already exists. Nothing changed.`); } else {
    await User.create({ name, email, role: 'admin', passwordHash: await bcrypt.hash(password, 12) });
    console.log(`Admin created: ${email}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
