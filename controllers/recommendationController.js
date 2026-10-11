const Recommendation = require('../models/Recommendation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getOwnStudent, getScope } = require('../services/access');
const { generateFor } = require('../services/recommendationService');
const { paginate, pageMeta, mustFind } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const scope = await getScope(req.user, req.query.studentId || undefined);
  if (!scope.single) throw new ApiError(400, 'studentId is required.');
  const { page, limit, skip } = paginate(req.query);
  const f = { student: scope.studentIds[0] };
  if (req.query.status && req.query.status !== 'all') f.status = req.query.status;
  const [rows, total] = await Promise.all([Recommendation.find(f).populate('subject', 'name code').sort({ status: 1, priority: 1, createdAt: -1 }).skip(skip).limit(limit), Recommendation.countDocuments(f)]);
  res.json({ success: true, data: rows, pagination: pageMeta(page, limit, total) });
});

exports.generate = asyncHandler(async (req, res) => {
  const s = await getOwnStudent(req.user);
  const rows = await generateFor(s._id);
  res.json({ success: true, message: `${rows.length} active recommendation(s).`, data: rows });
});

exports.update = asyncHandler(async (req, res) => {
  const s = await getOwnStudent(req.user);
  const rec = mustFind(await Recommendation.findOne({ _id: req.params.id, student: s._id }), 'Recommendation');
  rec.status = req.body.status;
  rec.resolvedAt = rec.status === 'Active' ? null : new Date();
  await rec.save();
  res.json({ success: true, message: `Marked as ${rec.status}.`, data: rec });
});

exports.remove = asyncHandler(async (req, res) => {
  const s = await getOwnStudent(req.user);
  mustFind(await Recommendation.findOneAndDelete({ _id: req.params.id, student: s._id }), 'Recommendation');
  res.json({ success: true, message: 'Recommendation removed.' });
});
