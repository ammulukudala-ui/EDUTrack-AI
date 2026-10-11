const Student = require('../models/Student');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const { buildFilter } = require('../services/access');
const { getSummary } = require('../services/analyticsService');
const { assessStudent, scopeKeyFor } = require('../services/riskAnalyzer');
const { escapeRegex, paginate, pageMeta, dateRange } = require('../utils/helpers');

// Turns query string + permissions into separate filters for each collection.
async function summaryFilters(req) {
  const { f, scope } = await buildFilter(req);
  const { assessmentType, status, ...common } = f; // eslint-disable-line no-unused-vars
  const task = { ...(common.student ? { student: common.student } : {}), ...(common.subject ? { subject: common.subject } : {}), ...dateRange('dueDate', req.query.from, req.query.to) };
  return { filters: { rec: { ...common, ...(assessmentType ? { assessmentType } : {}) }, att: { ...common }, study: { ...common }, task }, scope };
}

exports.dashboard = asyncHandler(async (req, res) => {
  const { filters, scope } = await summaryFilters(req);
  const data = await getSummary(filters, { single: !!scope.single });
  res.json({ success: true, data });
});
exports.performance = asyncHandler(async (req, res) => {
  const { filters, scope } = await summaryFilters(req);
  const d = await getSummary(filters, { single: !!scope.single });
  res.json({ success: true, data: { overallAverage: d.overallAverage, subjectPerformance: d.subjectPerformance, trend: d.trend, weakSubjects: d.weakSubjects, recordCount: d.recordCount, trendMode: scope.single ? 'assessment' : 'month' } });
});
exports.attendance = asyncHandler(async (req, res) => {
  const { filters, scope } = await summaryFilters(req);
  const d = await getSummary(filters, { single: !!scope.single });
  res.json({ success: true, data: { overallAttendance: d.overallAttendance, target: d.attendanceTarget, attendanceBySubject: d.attendanceBySubject } });
});
exports.productivity = asyncHandler(async (req, res) => {
  const { filters, scope } = await summaryFilters(req);
  const d = await getSummary(filters, { single: !!scope.single });
  res.json({ success: true, data: { study: d.study, tasks: d.tasks } });
});

// ---- Cohort table for faculty/admin: students + advisory risk (computed live, one stored assessment per day)
async function cohortRows(req, cap = 300) {
  const { scope } = await buildFilter(req);
  const f = { active: true };
  if (scope.studentIds) f._id = { $in: scope.studentIds };
  if (req.query.department) f.department = req.query.department;
  if (req.query.semester) f.semester = Number(req.query.semester);
  if (req.query.subject) f.subjects = req.query.subject;
  if (req.query.q) {
    const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 50)), 'i');
    f.$or = [{ studentId: rx }, { user: { $in: await User.find({ role: 'student', name: rx }).distinct('_id') } }];
  }
  const students = await Student.find(f).populate('user', 'name').limit(cap);
  const rows = [];
  for (let i = 0; i < students.length; i += 10) {
    const part = await Promise.all(students.slice(i, i + 10).map(async (s) => {
      const r = await assessStudent(s._id, { store: true, subjectIds: scope.subjectIds || undefined, scopeKey: scopeKeyFor(req.user) });
      return { id: s._id, studentId: s.studentId, name: s.user ? s.user.name : '—', department: s.department, semester: s.semester,
        status: r.status, score: r.score, category: r.category, completeness: r.dataCompleteness, overallAverage: r.evidence.overallAverage ?? null,
        attendancePct: r.evidence.attendancePct ?? null, explanation: r.explanation, missing: r.missing };
    }));
    rows.push(...part);
  }
  rows.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  return rows;
}
exports.cohortRows = cohortRows;

exports.cohort = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  let rows = await cohortRows(req);
  const distribution = { 'Low Risk': 0, 'Moderate Risk': 0, 'High Risk': 0, 'Insufficient data': 0 };
  rows.forEach((r) => { distribution[r.status === 'ok' ? r.category : 'Insufficient data'] += 1; });
  const sufficient = rows.filter((r) => r.status === 'ok').length;
  if (req.query.category) rows = rows.filter((r) => (r.status === 'ok' ? r.category : 'Insufficient data') === req.query.category);
  res.json({ success: true, data: rows.slice(skip, skip + limit), distribution, sufficientCount: sufficient, totalStudents: Object.values(distribution).reduce((a, b) => a + b, 0), pagination: pageMeta(page, limit, rows.length) });
});
