const User = require('../models/User');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const AcademicRecord = require('../models/AcademicRecord');
const Attendance = require('../models/Attendance');
const StudyTask = require('../models/StudyTask');
const RiskAssessment = require('../models/RiskAssessment');
const AuditLog = require('../models/AuditLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getSummary } = require('../services/analyticsService');
const { hash } = require('./authController');
const { escapeRegex, paginate, pageMeta, audit, mustFind } = require('../utils/helpers');

exports.stats = asyncHandler(async (req, res) => {
  const [students, faculty, subjects, records, attendance, pending, summary, risk] = await Promise.all([
    Student.countDocuments({ active: true }), User.countDocuments({ role: 'faculty', active: true }), Subject.countDocuments({ active: true }),
    AcademicRecord.countDocuments(), Attendance.countDocuments(), StudyTask.countDocuments({ status: { $ne: 'Completed' } }),
    getSummary({ rec: {}, att: {}, study: {}, task: {} }),
    RiskAssessment.aggregate([{ $sort: { assessedAt: -1 } }, { $group: { _id: '$student', status: { $first: '$status' }, category: { $first: '$category' } } },
      { $group: { _id: { $cond: [{ $eq: ['$status', 'ok'] }, '$category', 'Insufficient data'] }, n: { $sum: 1 } } }])
  ]);
  const distribution = { 'Low Risk': 0, 'Moderate Risk': 0, 'High Risk': 0, 'Insufficient data': 0 };
  risk.forEach((r) => { distribution[r._id] = r.n; });
  res.json({ success: true, data: { students, faculty, subjects, records, attendance, pendingTasks: pending, averageMarks: summary.overallAverage, overallAttendance: summary.overallAttendance,
    riskDistribution: distribution, riskNote: 'Based on the latest stored advisory assessment of each student.' } });
});

exports.listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const f = {};
  if (req.query.role) f.role = req.query.role;
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 50)), 'i'); f.$or = [{ name: rx }, { email: rx }]; }
  const [rows, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit), User.countDocuments(f)]);
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, total) });
});

// Admin creates faculty / admin accounts (students are created from the Students page).
exports.createUser = asyncHandler(async (req, res) => {
  if (!['faculty', 'admin'].includes(req.body.role)) throw new ApiError(422, 'Role must be faculty or admin. Create students from the Students page.');
  if (await User.exists({ email: req.body.email })) throw new ApiError(409, 'This email is already registered.');
  const u = await User.create({ name: req.body.name, email: req.body.email, role: req.body.role, department: req.body.department, passwordHash: await hash(req.body.password) });
  await audit(req, 'CREATE_USER', 'User', u._id, `${u.email} (${u.role})`);
  res.status(201).json({ success: true, message: 'User created.', data: u });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const u = mustFind(await User.findById(req.params.id), 'User');
  if (String(u._id) === String(req.user._id) && (req.body.active === false || (req.body.role && req.body.role !== 'admin'))) throw new ApiError(400, 'You cannot deactivate or demote your own account.');
  ['name', 'department', 'active'].forEach((k) => { if (req.body[k] !== undefined) u[k] = req.body[k]; });
  if (req.body.role && u.role !== 'student' && ['faculty', 'admin'].includes(req.body.role)) u.role = req.body.role; // students cannot become staff by accident
  if (req.body.password) u.passwordHash = await hash(req.body.password);
  await u.save();
  await audit(req, 'UPDATE_USER', 'User', u._id, `${u.email} role=${u.role} active=${u.active}`);
  res.json({ success: true, message: 'User updated.', data: u });
});

exports.facultyList = asyncHandler(async (req, res) => res.json({ success: true, data: await User.find({ role: 'faculty', active: true }).select('name email department').sort({ name: 1 }) }));

exports.audit = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const [rows, total] = await Promise.all([AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit), AuditLog.countDocuments()]);
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, total) });
});
