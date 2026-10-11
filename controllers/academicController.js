const AcademicRecord = require('../models/AcademicRecord');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getScope, recordFilter, buildFilter, assertCanWrite } = require('../services/access');
const { paginate, pageMeta, audit, mustFind } = require('../utils/helpers');

const populate = [{ path: 'student', select: 'studentId user', populate: { path: 'user', select: 'name' } }, { path: 'subject', select: 'code name' }];

exports.create = asyncHandler(async (req, res) => {
  const b = req.body;
  await assertCanWrite(req.user, b.student, b.subject);
  const rec = await AcademicRecord.create({ student: b.student, subject: b.subject, assessmentName: b.assessmentName, assessmentType: b.assessmentType,
    marksObtained: b.marksObtained, maxMarks: b.maxMarks, date: b.date, remarks: b.remarks, recordedBy: req.user._id });
  await audit(req, 'CREATE_RECORD', 'AcademicRecord', rec._id, `${b.assessmentName}: ${b.marksObtained}/${b.maxMarks}`);
  res.status(201).json({ success: true, message: 'Academic record saved.', data: await rec.populate(populate) });
});

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const { f } = await buildFilter(req);
  const [rows, total, agg] = await Promise.all([
    AcademicRecord.find(f).populate(populate).sort({ date: -1 }).skip(skip).limit(limit),
    AcademicRecord.countDocuments(f),
    AcademicRecord.aggregate([{ $match: f }, { $match: { maxMarks: { $gt: 0 } } }, { $group: { _id: null, avg: { $avg: { $multiply: [{ $divide: ['$marksObtained', '$maxMarks'] }, 100] } }, n: { $sum: 1 } } }])
  ]);
  res.json({ success: true, data: rows, summary: { count: total, averagePercentage: agg[0] ? Math.round(agg[0].avg * 100) / 100 : null }, pagination: pageMeta(page, limit, total) });
});

async function loadAllowed(req) {
  const scope = await getScope(req.user);
  return mustFind(await AcademicRecord.findOne({ _id: req.params.id, ...recordFilter(scope) }), 'Academic record'); // ownership + scope check
}

exports.get = asyncHandler(async (req, res) => {
  const rec = await loadAllowed(req);
  res.json({ success: true, data: await rec.populate(populate) });
});

exports.update = asyncHandler(async (req, res) => {
  const rec = await loadAllowed(req);
  const b = req.body;
  await assertCanWrite(req.user, b.student || rec.student, b.subject || rec.subject);
  ['student', 'subject', 'assessmentName', 'assessmentType', 'marksObtained', 'maxMarks', 'date', 'remarks'].forEach((k) => { if (b[k] !== undefined) rec[k] = b[k]; });
  rec.recordedBy = req.user._id;
  await rec.save();
  await audit(req, 'UPDATE_RECORD', 'AcademicRecord', rec._id, `${rec.assessmentName}: ${rec.marksObtained}/${rec.maxMarks}`);
  res.json({ success: true, message: 'Academic record updated.', data: await rec.populate(populate) });
});

exports.remove = asyncHandler(async (req, res) => {
  const rec = await loadAllowed(req);
  await rec.deleteOne();
  await audit(req, 'DELETE_RECORD', 'AcademicRecord', rec._id, rec.assessmentName);
  res.json({ success: true, message: 'Academic record deleted.' });
});
