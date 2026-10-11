const RiskAssessment = require('../models/RiskAssessment');
const asyncHandler = require('../utils/asyncHandler');
const { getScope, getOwnStudent } = require('../services/access');
const { assessStudent, scopeKeyFor } = require('../services/riskAnalyzer');

exports.mine = asyncHandler(async (req, res) => {
  const s = await getOwnStudent(req.user);
  res.json({ success: true, data: await assessStudent(s._id) });
});

exports.forStudent = asyncHandler(async (req, res) => {
  const scope = await getScope(req.user, req.params.studentId); // 403 if not allowed
  const r = await assessStudent(req.params.studentId, { subjectIds: scope.subjectIds || undefined, scopeKey: scopeKeyFor(req.user) });
  res.json({ success: true, data: r, restrictedToSubjects: !!scope.subjectIds });
});

exports.history = asyncHandler(async (req, res) => {
  await getScope(req.user, req.params.studentId);
  const rows = await RiskAssessment.find({ student: req.params.studentId, scopeKey: scopeKeyFor(req.user) }).sort({ assessedAt: -1 }).limit(60).select('-factors');
  res.json({ success: true, data: rows });
});
