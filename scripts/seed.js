/**
 * Demo data (ALL FICTIONAL, example.com style addresses).
 *   npm run seed          -> adds demo data (skips if demo data already exists)
 *   npm run seed:reset    -> removes ONLY the demo data (emails ending @edutrack.example) and re-creates it
 * Never runs automatically. Refuses to touch a database whose name contains "prod".
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { User, Student, Subject, AcademicRecord, Attendance, StudyLog, StudyTask, Recommendation, RiskAssessment } = {
  User: require('../models/User'), Student: require('../models/Student'), Subject: require('../models/Subject'), AcademicRecord: require('../models/AcademicRecord'),
  Attendance: require('../models/Attendance'), StudyLog: require('../models/StudyLog'), StudyTask: require('../models/StudyTask'),
  Recommendation: require('../models/Recommendation'), RiskAssessment: require('../models/RiskAssessment')
};
const { assessStudent } = require('../services/riskAnalyzer');
const { generateFor } = require('../services/recommendationService');

const DOMAIN = '@edutrack.example';
const PASSWORDS = { admin: 'Admin@12345', faculty: 'Faculty@123', student: 'Student@123' };
const DEPT = 'Computer Science';

function rng(seed) { let a = seed; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const daysAgo = (n) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - n); return d; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const SUBJECTS = [
  { code: 'CS301', name: 'Database Management Systems', credits: 4 }, { code: 'CS302', name: 'Operating Systems', credits: 4 },
  { code: 'CS303', name: 'Computer Networks', credits: 3 }, { code: 'MA304', name: 'Discrete Mathematics', credits: 3 }
];
const FACULTY = [{ name: 'Dr. Asha Demo', n: 1, subj: ['CS301', 'CS302'] }, { name: 'Prof. Ravi Sample', n: 2, subj: ['CS303'] }, { name: 'Dr. Meera Example', n: 3, subj: ['MA304'] }];
// profile: base marks %, trend per assessment, attendance probability, task completion probability, study minutes per session, assessments (0 = none)
const STUDENTS = [
  { name: 'Aarav Demo', id: 'DEMO001', base: 82, trend: 1, att: 0.95, task: 0.9, study: 75, n: 4 },
  { name: 'Diya Sample', id: 'DEMO002', base: 68, trend: 0, att: 0.85, task: 0.7, study: 50, n: 4 },
  { name: 'Kabir Example', id: 'DEMO003', base: 74, trend: -6, att: 0.7, task: 0.5, study: 30, n: 4 },
  { name: 'Isha Test', id: 'DEMO004', base: 45, trend: -2, att: 0.6, task: 0.3, study: 20, n: 4 },
  { name: 'Rohan Fictional', id: 'DEMO005', base: 58, trend: 3, att: 0.8, task: 0.6, study: 45, n: 4 },
  { name: 'Sana Demo', id: 'DEMO006', base: 90, trend: 0, att: 0.98, task: 1, study: 90, n: 4 },
  { name: 'Vikram Sample', id: 'DEMO007', base: 62, trend: -1, att: 0.55, task: 0.4, study: 25, n: 4 },
  { name: 'Neha NewJoiner', id: 'DEMO008', base: 70, trend: 0, att: 0.9, task: 0.8, study: 40, n: 1 } // little data -> "insufficient data" demo
];

async function reset() {
  const users = await User.find({ email: new RegExp(DOMAIN.replace('.', '\\.') + '$') }).select('_id');
  const students = await Student.find({ user: { $in: users.map((u) => u._id) } }).select('_id');
  const sid = students.map((s) => s._id);
  await Promise.all([AcademicRecord, Attendance, StudyLog, StudyTask, Recommendation, RiskAssessment].map((M) => M.deleteMany({ student: { $in: sid } })));
  await Student.deleteMany({ _id: { $in: sid } });
  await Subject.deleteMany({ code: { $in: SUBJECTS.map((s) => s.code) } });
  await User.deleteMany({ _id: { $in: users.map((u) => u._id) } });
  console.log(`Removed demo data (${users.length} demo users and linked records).`);
}

async function main() {
  const db = await connectDB();
  if (/prod/i.test(db.name)) { console.error('Refusing to seed a database whose name contains "prod".'); process.exit(1); }
  if (process.argv.includes('--reset')) await reset();
  else if (await User.exists({ email: `admin${DOMAIN}` })) { console.log('Demo data already exists. Use "npm run seed:reset" to rebuild it.'); return; }

  const hashes = {}; for (const k of Object.keys(PASSWORDS)) hashes[k] = await bcrypt.hash(PASSWORDS[k], 10);
  await User.create({ name: 'Demo Administrator', email: `admin${DOMAIN}`, role: 'admin', passwordHash: hashes.admin });
  const facultyBySubject = {};
  for (const f of FACULTY) {
    const u = await User.create({ name: f.name, email: `faculty${f.n}${DOMAIN}`, role: 'faculty', department: DEPT, passwordHash: hashes.faculty });
    f.subj.forEach((c) => { facultyBySubject[c] = u._id; });
  }
  const subjects = [];
  for (const s of SUBJECTS) subjects.push(await Subject.create({ ...s, department: DEPT, semester: 5, faculty: facultyBySubject[s.code] }));

  const students = [];
  for (const [i, p] of STUDENTS.entries()) {
    const u = await User.create({ name: p.name, email: `student${i + 1}${DOMAIN}`, role: 'student', passwordHash: hashes.student });
    const st = await Student.create({ studentId: p.id, user: u._id, department: DEPT, semester: 5, year: 3, subjects: subjects.map((s) => s._id) });
    students.push({ st, p, r: rng(1000 + i) });
  }

  const TYPES = ['Quiz', 'Assignment', 'Internal Examination', 'Practical', 'Internal Examination'];
  for (const { st, p, r } of students) {
    for (const [si, sub] of subjects.entries()) {
      for (let k = 0; k < p.n; k++) {
        const max = k % 2 === 0 ? 50 : 100; // a mix of maximum marks
        const pct = clamp(p.base + p.trend * k + (si - 1.5) * 4 + (r() - 0.5) * 12, 5, 100);
        await AcademicRecord.create({ student: st._id, subject: sub._id, assessmentName: `${TYPES[k]} ${k + 1}`, assessmentType: TYPES[k], marksObtained: Math.round((pct / 100) * max), maxMarks: max,
          date: daysAgo(90 - k * 22 - si), recordedBy: sub.faculty });
        if (p.n === 1) break;
      }
      if (p.n > 1) for (let w = 0; w < 12; w++) { // weekly sessions
        const roll = r();
        await Attendance.create({ student: st._id, subject: sub._id, date: daysAgo(84 - w * 7 + si), status: roll < p.att ? (roll < 0.05 ? 'Late' : 'Present') : 'Absent', recordedBy: sub.faculty });
      }
    }
    if (p.n > 1) {
      for (let d = 0; d < 28; d++) if (r() < 0.6) {
        const sub = subjects[Math.floor(r() * subjects.length)];
        await StudyLog.create({ student: st._id, subject: sub._id, date: daysAgo(d), durationMinutes: Math.round(p.study * (0.6 + r() * 0.8)), topic: `${sub.name} revision`, completed: true });
      }
      const titles = ['Revise unit 1', 'Finish assignment', 'Practice problems', 'Lab record', 'Prepare notes', 'Mock test'];
      for (let t = 0; t < 6; t++) {
        const due = daysAgo(18 - t * 5); const past = due < new Date();
        const done = past ? r() < p.task : false;
        await StudyTask.create({ student: st._id, subject: subjects[t % 4]._id, title: titles[t], description: 'Demo task', priority: ['Low', 'Medium', 'High'][t % 3], dueDate: due,
          status: done ? 'Completed' : (!past && t % 2 ? 'In Progress' : 'Pending'), completedAt: done ? due : null });
      }
    } else {
      await StudyTask.create({ student: st._id, subject: subjects[0]._id, title: 'Read syllabus', priority: 'Low', dueDate: daysAgo(-3) });
    }
    await assessStudent(st._id); await generateFor(st._id);
  }
  console.log('\nDemo data created. Log in with:');
  console.log(`  Admin   : admin${DOMAIN}     / ${PASSWORDS.admin}`);
  console.log(`  Faculty : faculty1${DOMAIN}   / ${PASSWORDS.faculty}   (also faculty2, faculty3)`);
  console.log(`  Student : student1${DOMAIN}   / ${PASSWORDS.student}   (student1 ... student8)`);
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => mongoose.disconnect());
