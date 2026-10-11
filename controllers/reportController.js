const AcademicRecord = require('../models/AcademicRecord');
const Attendance = require('../models/Attendance');
const StudyLog = require('../models/StudyLog');
const StudyTask = require('../models/StudyTask');
const Recommendation = require('../models/Recommendation');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { buildFilter, getOwnStudent } = require('../services/access');
const { getSummary, formatMinutes } = require('../services/analyticsService');
const { toCsv } = require('../utils/csv');
const { cohortRows } = require('./analyticsController');

const pop = [{ path: 'student', select: 'studentId user', populate: { path: 'user', select: 'name' } }, { path: 'subject', select: 'code name' }];
const who = (r) => [r.student?.studentId, r.student?.user?.name];
const LIMIT = 5000;

const builders = {
  async academic(req) {
    const { f } = await buildFilter(req);
    const rows = await AcademicRecord.find(f).populate(pop).sort({ date: -1 }).limit(LIMIT);
    return [['Student ID', 'Student', 'Subject Code', 'Subject', 'Assessment', 'Type', 'Date', 'Marks', 'Max Marks', 'Percentage', 'Remarks'],
      rows.map((r) => [...who(r), r.subject?.code, r.subject?.name, r.assessmentName, r.assessmentType, r.date, r.marksObtained, r.maxMarks, r.percentage, r.remarks])];
  },
  async attendance(req) {
    const { f } = await buildFilter(req);
    const rows = await Attendance.find(f).populate(pop).sort({ date: -1 }).limit(LIMIT);
    return [['Student ID', 'Student', 'Subject Code', 'Subject', 'Date', 'Status', 'Remarks'], rows.map((r) => [...who(r), r.subject?.code, r.subject?.name, r.date, r.status, r.remarks])];
  },
  async study(req) {
    const { f } = await buildFilter(req);
    const rows = await StudyLog.find(f).populate(pop).sort({ date: -1 }).limit(LIMIT);
    return [['Student ID', 'Student', 'Subject', 'Date', 'Minutes', 'Duration', 'Topic', 'Notes'], rows.map((r) => [...who(r), r.subject?.name, r.date, r.durationMinutes, formatMinutes(r.durationMinutes), r.topic, r.notes])];
  },
  async tasks(req) {
    const s = await getOwnStudent(req.user);
    const rows = await StudyTask.find({ student: s._id }).populate('subject', 'name').sort({ dueDate: 1 });
    return [['Title', 'Subject', 'Priority', 'Due Date', 'Status', 'Completed At'], rows.map((t) => [t.title, t.subject?.name, t.priority, t.dueDate, t.status, t.completedAt])];
  },
  async 'subject-averages'(req) {
    const { f } = await buildFilter(req);
    const d = await getSummary({ rec: f, att: {}, study: {}, task: {} });
    return [['Subject Code', 'Subject', 'Average %', 'Assessments'], d.subjectPerformance.map((s) => [s.code, s.name, s.average, s.count])];
  },
  async 'attendance-summary'(req) {
    const { f } = await buildFilter(req);
    const d = await getSummary({ rec: {}, att: f, study: {}, task: {} });
    return [['Subject Code', 'Subject', 'Attended', 'Counted Classes', 'Excused (not counted)', 'Attendance %', `Target ${d.attendanceTarget}%`, 'Classes Needed'],
      d.attendanceBySubject.map((s) => [s.code, s.name, s.attended, s.total, s.excused, s.percentage ?? 'Insufficient attendance data', d.attendanceTarget, s.classesNeeded ?? ''])];
  },
  async 'study-summary'(req) {
    const { f } = await buildFilter(req);
    const d = await getSummary({ rec: {}, att: {}, study: f, task: {} });
    return [['Subject', 'Total Minutes', 'Duration'], d.study.bySubject.map((s) => [s.name, s.minutes, formatMinutes(s.minutes)])];
  },
  async recommendations(req) {
    const s = await getOwnStudent(req.user);
    const rows = await Recommendation.find({ student: s._id }).sort({ createdAt: -1 });
    return [['Created', 'Type', 'Title', 'Why', 'Suggested Action', 'Status'], rows.map((r) => [r.createdAt, r.type, r.title, r.explanation, r.action, r.status])];
  },
  async risk(req) {
    if (req.user.role === 'student') throw new ApiError(403, 'Not available for students.');
    const rows = await cohortRows(req);
    return [['Student ID', 'Student', 'Department', 'Semester', 'Advisory Score', 'Category', 'Data Completeness %', 'Avg Marks %', 'Attendance %', 'Explanation (advisory only)'],
      rows.map((r) => [r.studentId, r.name, r.department, r.semester, r.score ?? 'Insufficient data', r.category ?? 'Insufficient data', r.completeness, r.overallAverage, r.attendancePct, r.explanation])];
  }
};
const staffOnly = new Set(['risk']), studentOnly = new Set(['tasks', 'recommendations']);

exports.download = asyncHandler(async (req, res) => {
  const type = req.params.type;
  if (!builders[type]) throw new ApiError(404, 'Unknown report type.');
  if (staffOnly.has(type) && req.user.role === 'student') throw new ApiError(403, 'Not available for students.');
  if (studentOnly.has(type) && req.user.role !== 'student') throw new ApiError(403, 'This report is only for students.');
  const [headers, rows] = await builders[type](req);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="edutrack-${type}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send('\uFEFF' + toCsv(headers, rows));
});
