const StudyLog = require('../models/StudyLog');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnStudent, buildFilter } = require('../services/access');
const { paginate, pageMeta, mustFind } = require('../utils/helpers');

const populate = [{ path: 'subject', select: 'code name' }, { path: 'student', select: 'studentId user', populate: { path: 'user', select: 'name' } }];

async function ownSubjectCheck(student, subjectId) {
  if (!student.subjects.some((s) => String(s) === String(subjectId))) throw new ApiError(422, 'You are not enrolled in this subject.');
}

exports.create = asyncHandler(async (req, res) => {
  const student = await getOwnStudent(req.user);
  await ownSubjectCheck(student, req.body.subject);
  const log = await StudyLog.create({ student: student._id, subject: req.body.subject, date: req.body.date, durationMinutes: req.body.durationMinutes,
    topic: req.body.topic, notes: req.body.notes, completed: req.body.completed !== false });
  res.status(201).json({ success: true, message: 'Study session saved.', data: await log.populate(populate) });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const { f } = await buildFilter(req);
  const [rows, total, agg] = await Promise.all([StudyLog.find(f).populate(populate).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit), StudyLog.countDocuments(f),
    StudyLog.aggregate([{ $match: f }, { $group: { _id: null, minutes: { $sum: '$durationMinutes' } } }])]);
  res.json({ success: true, data: rows, summary: { totalMinutes: agg[0] ? agg[0].minutes : 0, count: total }, pagination: pageMeta(page, limit, total) });
});

async function loadOwn(req) {
  const student = await getOwnStudent(req.user);
  return { student, log: mustFind(await StudyLog.findOne({ _id: req.params.id, student: student._id }), 'Study session') };
}
exports.get = asyncHandler(async (req, res) => {
  const { f } = await buildFilter(req);
  res.json({ success: true, data: mustFind(await StudyLog.findOne({ ...f, _id: req.params.id }).populate(populate), 'Study session') });
});
exports.update = asyncHandler(async (req, res) => {
  const { student, log } = await loadOwn(req);
  if (req.body.subject) await ownSubjectCheck(student, req.body.subject);
  ['subject', 'date', 'durationMinutes', 'topic', 'notes', 'completed'].forEach((k) => { if (req.body[k] !== undefined) log[k] = req.body[k]; });
  await log.save();
  res.json({ success: true, message: 'Study session updated.', data: await log.populate(populate) });
});
exports.remove = asyncHandler(async (req, res) => {
  const { log } = await loadOwn(req);
  await log.deleteOne();
  res.json({ success: true, message: 'Study session deleted.' });
});
