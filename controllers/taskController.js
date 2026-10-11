const StudyTask = require('../models/StudyTask');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnStudent } = require('../services/access');
const { paginate, pageMeta, dateRange, mustFind, oid } = require('../utils/helpers');

async function check(student, subject) {
  if (subject && !student.subjects.some((s) => String(s) === String(subject))) throw new ApiError(422, 'You are not enrolled in this subject.');
}
const applyStatus = (task) => { task.completedAt = task.status === 'Completed' ? (task.completedAt || new Date()) : null; };

exports.create = asyncHandler(async (req, res) => {
  const student = await getOwnStudent(req.user);
  await check(student, req.body.subject);
  const task = new StudyTask({ student: student._id, subject: req.body.subject || null, title: req.body.title, description: req.body.description,
    priority: req.body.priority, dueDate: req.body.dueDate, status: req.body.status });
  applyStatus(task); await task.save();
  res.status(201).json({ success: true, message: 'Task created.', data: await task.populate('subject', 'code name') });
});

exports.list = asyncHandler(async (req, res) => {
  const student = await getOwnStudent(req.user);
  const { page, limit, skip } = paginate(req.query);
  const f = { student: student._id };
  if (req.query.subject) f.subject = oid(req.query.subject);
  if (req.query.priority) f.priority = req.query.priority;
  if (req.query.status === 'open') f.status = { $ne: 'Completed' };
  else if (req.query.status) f.status = req.query.status;
  if (req.query.overdue === 'true') { f.status = { $ne: 'Completed' }; f.dueDate = { $lt: new Date() }; }
  else Object.assign(f, dateRange('dueDate', req.query.from, req.query.to));
  const [rows, total, all] = await Promise.all([
    StudyTask.find(f).populate('subject', 'code name').sort({ dueDate: 1 }).skip(skip).limit(limit), StudyTask.countDocuments(f),
    StudyTask.aggregate([{ $match: { student: student._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }])]);
  const c = { Pending: 0, 'In Progress': 0, Completed: 0 }; all.forEach((g) => { c[g._id] = g.n; });
  const totalAll = c.Pending + c['In Progress'] + c.Completed;
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, total),
    summary: { ...c, total: totalAll, completionPercentage: totalAll ? Math.round((c.Completed / totalAll) * 100) : null } });
});

async function loadOwn(req) {
  const student = await getOwnStudent(req.user);
  return { student, task: mustFind(await StudyTask.findOne({ _id: req.params.id, student: student._id }), 'Task') };
}
exports.get = asyncHandler(async (req, res) => res.json({ success: true, data: await (await loadOwn(req)).task.populate('subject', 'code name') }));
exports.update = asyncHandler(async (req, res) => {
  const { student, task } = await loadOwn(req);
  if (req.body.subject) await check(student, req.body.subject);
  ['title', 'description', 'subject', 'priority', 'dueDate', 'status'].forEach((k) => { if (req.body[k] !== undefined) task[k] = req.body[k] || (k === 'subject' ? null : req.body[k]); });
  applyStatus(task); await task.save();
  res.json({ success: true, message: 'Task updated.', data: await task.populate('subject', 'code name') });
});
exports.remove = asyncHandler(async (req, res) => {
  const { task } = await loadOwn(req);
  await task.deleteOne();
  res.json({ success: true, message: 'Task deleted.' });
});
