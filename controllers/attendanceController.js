const Attendance = require('../models/Attendance');
const asyncHandler = require('../utils/asyncHandler');
const { getScope, recordFilter, buildFilter, assertCanWrite } = require('../services/access');
const { calcAttendance, classesNeeded } = require('../services/analyticsService');
const { paginate, pageMeta, audit, mustFind } = require('../utils/helpers');

const populate = [{ path: 'student', select: 'studentId user', populate: { path: 'user', select: 'name' } }, { path: 'subject', select: 'code name' }];
const target = () => Number(process.env.ATTENDANCE_TARGET) || 75;

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  await assertCanWrite(req.user, b.student, b.subject);
  const rec = await Attendance.create({ student: b.student, subject: b.subject, date: b.date, status: b.status, remarks: b.remarks, recordedBy: req.user._id });
  await audit(req, 'CREATE_ATTENDANCE', 'Attendance', rec._id, `${b.status} ${String(b.date).slice(0, 10)}`);
  res.status(201).json({ success: true, message: 'Attendance recorded.', data: await rec.populate(populate) });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const { f } = await buildFilter(req);
  const [rows, total, groups] = await Promise.all([
    Attendance.find(f).populate(populate).sort({ date: -1 }).skip(skip).limit(limit), Attendance.countDocuments(f),
    Attendance.aggregate([{ $match: f }, { $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);
  const counts = {}; groups.forEach((g) => { counts[g._id] = g.n; });
  const a = calcAttendance(counts); // denominator = Present + Late + Absent (Excused not counted)
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, total),
    summary: { ...a, target: target(), classesNeeded: classesNeeded(a.attended, a.total, target()),
      message: a.percentage === null ? 'Insufficient attendance data' : undefined } });
});

async function loadAllowed(req) {
  const scope = await getScope(req.user);
  return mustFind(await Attendance.findOne({ _id: req.params.id, ...recordFilter(scope) }), 'Attendance record');
}
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await (await loadAllowed(req)).populate(populate) }));

exports.update = asyncHandler(async (req, res) => {
  const rec = await loadAllowed(req);
  await assertCanWrite(req.user, rec.student, rec.subject);
  ['status', 'remarks', 'date'].forEach((k) => { if (req.body[k] !== undefined) rec[k] = req.body[k]; });
  rec.recordedBy = req.user._id;
  await rec.save();
  await audit(req, 'UPDATE_ATTENDANCE', 'Attendance', rec._id, rec.status);
  res.json({ success: true, message: 'Attendance updated.', data: await rec.populate(populate) });
});

exports.remove = asyncHandler(async (req, res) => {
  const rec = await loadAllowed(req);
  await rec.deleteOne(); await audit(req, 'DELETE_ATTENDANCE', 'Attendance', rec._id, '');
  res.json({ success: true, message: 'Attendance record deleted.' });
});
