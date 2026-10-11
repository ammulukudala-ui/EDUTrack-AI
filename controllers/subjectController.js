const Subject = require('../models/Subject');
const Student = require('../models/Student');
const AcademicRecord = require('../models/AcademicRecord');
const Attendance = require('../models/Attendance');
const StudyLog = require('../models/StudyLog');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnStudent } = require('../services/access');
const { escapeRegex, paginate, pageMeta, audit, mustFind } = require('../utils/helpers');

async function checkFaculty(id) {
  if (!id) return null;
  const f = await User.findOne({ _id: id, role: 'faculty', active: true });
  if (!f) throw new ApiError(422, 'Selected faculty member does not exist or is inactive.');
  return f._id;
}

exports.create = asyncHandler(async (req, res) => {
  const { code, name, department, semester, credits } = req.body;
  const subject = await Subject.create({ code, name, department, semester, credits, faculty: await checkFaculty(req.body.faculty) });
  await audit(req, 'CREATE_SUBJECT', 'Subject', subject._id, code);
  res.status(201).json({ success: true, message: 'Subject created.', data: await subject.populate('faculty', 'name email') });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query, 200);
  const f = {};
  if (req.user.role === 'faculty') f.faculty = req.user._id;
  if (req.user.role === 'student') f._id = { $in: (await getOwnStudent(req.user)).subjects };
  if (req.query.department) f.department = req.query.department;
  if (req.query.semester) f.semester = Number(req.query.semester);
  if (req.query.active === 'true' || req.query.active === 'false') f.active = req.query.active === 'true';
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 50)), 'i'); f.$or = [{ code: rx }, { name: rx }]; }
  const [rows, total] = await Promise.all([Subject.find(f).populate('faculty', 'name email').sort({ semester: 1, code: 1 }).skip(skip).limit(limit), Subject.countDocuments(f)]);
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, total) });
});

exports.get = asyncHandler(async (req, res) => {
  const s = mustFind(await Subject.findById(req.params.id).populate('faculty', 'name email'), 'Subject');
  if (req.user.role === 'faculty' && String(s.faculty?._id) !== String(req.user._id)) throw new ApiError(403, 'This subject is not assigned to you.');
  if (req.user.role === 'student' && !(await getOwnStudent(req.user)).subjects.some((x) => String(x) === String(s._id))) throw new ApiError(403, 'You are not enrolled in this subject.');
  res.json({ success: true, data: s });
});

exports.update = asyncHandler(async (req, res) => {
  const s = mustFind(await Subject.findById(req.params.id), 'Subject');
  ['code', 'name', 'department', 'semester', 'credits', 'active'].forEach((k) => { if (req.body[k] !== undefined) s[k] = req.body[k]; });
  if (req.body.faculty !== undefined) s.faculty = await checkFaculty(req.body.faculty);
  await s.save();
  await audit(req, 'UPDATE_SUBJECT', 'Subject', s._id, s.code);
  res.json({ success: true, message: 'Subject updated.', data: await s.populate('faculty', 'name email') });
});

exports.remove = asyncHandler(async (req, res) => {
  const s = mustFind(await Subject.findById(req.params.id), 'Subject');
  const linked = (await Promise.all([AcademicRecord, Attendance, StudyLog].map((M) => M.exists({ subject: s._id })))).some(Boolean) || (await Student.exists({ subjects: s._id }));
  if (linked) {
    s.active = false; await s.save(); await audit(req, 'DEACTIVATE_SUBJECT', 'Subject', s._id, s.code);
    return res.json({ success: true, deactivated: true, message: 'Subject is in use, so it was deactivated instead of deleted.' });
  }
  await Subject.deleteOne({ _id: s._id }); await audit(req, 'DELETE_SUBJECT', 'Subject', s._id, s.code);
  res.json({ success: true, deleted: true, message: 'Subject deleted.' });
});
