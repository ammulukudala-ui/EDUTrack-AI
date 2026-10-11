const User = require('../models/User');
const Student = require('../models/Student');
const AcademicRecord = require('../models/AcademicRecord');
const Attendance = require('../models/Attendance');
const StudyLog = require('../models/StudyLog');
const StudyTask = require('../models/StudyTask');
const Subject = require('../models/Subject');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getScope } = require('../services/access');
const { hash } = require('./authController');
const { escapeRegex, paginate, pageMeta, audit, mustFind } = require('../utils/helpers');

const shape = (s, role) => {
  const o = s.toObject ? s.toObject() : s;
  if (role === 'faculty') delete o.phone; // faculty don't need phone numbers
  return o;
};
const populate = [{ path: 'user', select: 'name email active createdAt' }, { path: 'subjects', select: 'code name' }];

exports.create = asyncHandler(async (req, res) => {
  const { name, email, password, studentId, department, semester, year, subjects, phone } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'This email is already registered.');
  const user = await User.create({ name, email, passwordHash: await hash(password), role: 'student' });
  let student;
  try {
    const subjectIds = subjects && subjects.length ? subjects : await Subject.find({ department, semester, active: true }).distinct('_id');
    student = await Student.create({ studentId, user: user._id, department, semester, year, phone, subjects: subjectIds });
  } catch (e) { await User.deleteOne({ _id: user._id }); throw e; }
  await audit(req, 'CREATE_STUDENT', 'Student', student._id, `${studentId} ${name}`);
  res.status(201).json({ success: true, message: 'Student created.', data: await Student.findById(student._id).populate(populate) });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const scope = await getScope(req.user);
  const f = {};
  if (scope.studentIds) f._id = { $in: scope.studentIds };
  if (req.query.department) f.department = req.query.department;
  if (req.query.semester) f.semester = Number(req.query.semester);
  if (req.query.year) f.year = Number(req.query.year);
  if (req.query.active === 'true' || req.query.active === 'false') f.active = req.query.active === 'true';
  if (req.query.subject && req.user.role !== 'student') f.subjects = req.query.subject;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 50)), 'i');
    const userIds = await User.find({ role: 'student', $or: [{ name: rx }, { email: rx }] }).distinct('_id');
    f.$or = [{ studentId: rx }, { user: { $in: userIds } }];
  }
  const [rows, total] = await Promise.all([
    Student.find(f).populate(populate).sort({ createdAt: -1 }).skip(skip).limit(limit), Student.countDocuments(f)]);
  res.json({ success: true, data: rows.map((s) => shape(s, req.user.role)), pagination: pageMeta(page, limit, total) });
});

exports.get = asyncHandler(async (req, res) => {
  await getScope(req.user, req.params.id); // throws 403 if not allowed
  const s = mustFind(await Student.findById(req.params.id).populate(populate), 'Student');
  res.json({ success: true, data: shape(s, req.user.role) });
});

exports.update = asyncHandler(async (req, res) => {
  const s = mustFind(await Student.findById(req.params.id), 'Student');
  const u = mustFind(await User.findById(s.user), 'User');
  const b = req.body;
  if (b.email && b.email !== u.email && (await User.exists({ email: b.email }))) throw new ApiError(409, 'This email is already registered.');
  ['studentId', 'department', 'semester', 'year', 'phone', 'subjects', 'active'].forEach((k) => { if (b[k] !== undefined) s[k] = b[k]; });
  if (b.name) u.name = b.name;
  if (b.email) u.email = b.email;
  if (b.active !== undefined) u.active = b.active;
  await s.save(); await u.save();
  await audit(req, 'UPDATE_STUDENT', 'Student', s._id, `${s.studentId}${b.active === false ? ' (deactivated)' : ''}`);
  res.json({ success: true, message: 'Student updated.', data: await Student.findById(s._id).populate(populate) });
});

// Safe delete: students with linked academic history are DEACTIVATED, never hard-deleted.
exports.remove = asyncHandler(async (req, res) => {
  const s = mustFind(await Student.findById(req.params.id), 'Student');
  const linked = (await Promise.all([AcademicRecord, Attendance, StudyLog, StudyTask].map((M) => M.exists({ student: s._id })))).some(Boolean);
  if (linked) {
    s.active = false; await s.save(); await User.updateOne({ _id: s.user }, { active: false });
    await audit(req, 'DEACTIVATE_STUDENT', 'Student', s._id, `${s.studentId} has linked records`);
    return res.json({ success: true, deactivated: true, message: 'Student has linked academic records, so the account was deactivated instead of deleted.' });
  }
  await Student.deleteOne({ _id: s._id }); await User.deleteOne({ _id: s.user });
  await audit(req, 'DELETE_STUDENT', 'Student', s._id, s.studentId);
  res.json({ success: true, deleted: true, message: 'Student deleted.' });
});
