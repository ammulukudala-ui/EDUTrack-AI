/**
 * Calculation helpers + database aggregation for analytics.
 * Pure functions (no DB) are at the top so they are easy to unit-test.
 */

const round2 = (n) => Math.round(n * 100) / 100;

// Percentage = (Marks Obtained / Maximum Marks) x 100. Returns null if max marks invalid.
function percentage(obtained, max) {
  const o = Number(obtained), m = Number(max);
  if (!isFinite(o) || !isFinite(m) || m <= 0 || o < 0) return null;
  return round2((o / m) * 100);
}

/**
 * Attendance rule (documented in README):
 *   Present + Late  -> attended
 *   Absent          -> counted as a missed class
 *   Excused         -> NOT counted at all (removed from the denominator)
 *   Percentage = attended / (Present + Late + Absent) x 100
 * No countable sessions -> pct is null ("Insufficient attendance data").
 */
function calcAttendance(counts) {
  const attended = (counts.Present || 0) + (counts.Late || 0);
  const total = attended + (counts.Absent || 0);
  return { attended, total, excused: counts.Excused || 0, percentage: total > 0 ? round2((attended / total) * 100) : null };
}

// How many extra consecutive classes must be attended to reach the target %? null = not applicable.
function classesNeeded(attended, total, target) {
  if (total <= 0) return null;
  if ((attended / total) * 100 >= target) return 0;
  if (target >= 100) return null; // can never reach 100% once a class is missed
  return Math.ceil((target * total - 100 * attended) / (100 - target));
}

function formatMinutes(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60), r = m % 60;
  return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

const mean = (arr) => (arr.length ? round2(arr.reduce((a, b) => a + b, 0) / arr.length) : null);

// records: [{percentage, subjectId, subjectName}] -> per-subject averages sorted lowest first
function subjectAverages(records) {
  const map = new Map();
  records.forEach((r) => {
    if (r.percentage == null) return;
    const k = String(r.subjectId);
    if (!map.has(k)) map.set(k, { subjectId: k, name: r.subjectName, code: r.subjectCode, values: [] });
    map.get(k).values.push(r.percentage);
  });
  return [...map.values()].map((s) => ({ subjectId: s.subjectId, name: s.name, code: s.code, average: mean(s.values), count: s.values.length }))
    .sort((a, b) => a.average - b.average);
}

/* ---------------- Database-backed helpers ---------------- */
function lazyModels() {
  return {
    AcademicRecord: require('../models/AcademicRecord'), Attendance: require('../models/Attendance'),
    StudyLog: require('../models/StudyLog'), StudyTask: require('../models/StudyTask'), Subject: require('../models/Subject')
  };
}

/** Load ONE student's raw data (used by the risk analyzer and recommendations). */
async function loadStudentData(studentId, { from, to, subjectIds } = {}) {
  const { AcademicRecord, Attendance, StudyLog, StudyTask } = lazyModels();
  const range = (field) => {
    if (!from && !to) return {};
    const q = {}; if (from) q.$gte = new Date(from); if (to) q.$lte = new Date(to);
    return { [field]: q };
  };
  const subj = subjectIds ? { subject: { $in: subjectIds } } : {}; // faculty only see THEIR subjects
  const [recs, att, logs, tasks] = await Promise.all([
    AcademicRecord.find({ student: studentId, ...subj, ...range('date') }).populate('subject', 'code name').sort({ date: 1 }).lean(),
    Attendance.find({ student: studentId, ...subj, ...range('date') }).populate('subject', 'code name').lean(),
    StudyLog.find({ student: studentId, ...subj, ...range('date') }).populate('subject', 'code name').lean(),
    StudyTask.find({ student: studentId, ...subj }).populate('subject', 'code name').lean()
  ]);
  const records = recs.filter((r) => r.subject).map((r) => ({
    id: String(r._id), date: r.date, name: r.assessmentName, type: r.assessmentType, marks: r.marksObtained, max: r.maxMarks,
    percentage: percentage(r.marksObtained, r.maxMarks), subjectId: String(r.subject._id), subjectName: r.subject.name, subjectCode: r.subject.code
  }));
  const bySubj = new Map();
  att.filter((a) => a.subject).forEach((a) => {
    const k = String(a.subject._id);
    if (!bySubj.has(k)) bySubj.set(k, { subjectId: k, name: a.subject.name, code: a.subject.code, counts: {} });
    const c = bySubj.get(k).counts; c[a.status] = (c[a.status] || 0) + 1;
  });
  const attendanceBySubject = [...bySubj.values()].map((s) => ({ subjectId: s.subjectId, name: s.name, code: s.code, ...calcAttendance(s.counts) }));
  return { records, attendanceBySubject, studyLogs: logs.filter((l) => l.subject), tasks };
}

/** Aggregate summary for a set of filters (works for one student or many). */
async function getSummary(f, { single = false } = {}) {
  const { AcademicRecord, Attendance, StudyLog, StudyTask } = lazyModels();
  const target = Number(process.env.ATTENDANCE_TARGET) || 75;
  const pctExpr = { $cond: [{ $gt: ['$maxMarks', 0] }, { $multiply: [{ $divide: ['$marksObtained', '$maxMarks'] }, 100] }, null] };

  const [subjAgg, trendAgg, attAgg, studyDay, studyWeek, studySubj, taskAgg] = await Promise.all([
    AcademicRecord.aggregate([{ $match: f.rec }, { $addFields: { pct: pctExpr } }, { $match: { pct: { $ne: null } } },
      { $group: { _id: '$subject', average: { $avg: '$pct' }, count: { $sum: 1 } } },
      { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 's' } }, { $unwind: '$s' },
      { $project: { _id: 0, subjectId: '$_id', name: '$s.name', code: '$s.code', average: { $round: ['$average', 2] }, count: 1 } }, { $sort: { average: 1 } }]),
    single
      ? AcademicRecord.aggregate([{ $match: f.rec }, { $addFields: { pct: pctExpr } }, { $match: { pct: { $ne: null } } }, { $sort: { date: 1 } }, { $limit: 300 },
        { $lookup: { from: 'subjects', localField: 'subject', foreignField: '_id', as: 's' } }, { $unwind: '$s' },
        { $project: { _id: 0, date: 1, label: '$assessmentName', subject: '$s.name', assessmentType: 1, percentage: { $round: ['$pct', 2] } } }])
      : AcademicRecord.aggregate([{ $match: f.rec }, { $addFields: { pct: pctExpr } }, { $match: { pct: { $ne: null } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$date' } }, percentage: { $avg: '$pct' }, count: { $sum: 1 } } }, { $sort: { _id: 1 } },
        { $project: { _id: 0, date: '$_id', label: '$_id', percentage: { $round: ['$percentage', 2] }, count: 1 } }]),
    Attendance.aggregate([{ $match: f.att }, { $group: { _id: { subject: '$subject', status: '$status' }, n: { $sum: 1 } } },
      { $lookup: { from: 'subjects', localField: '_id.subject', foreignField: '_id', as: 's' } }, { $unwind: '$s' }]),
    StudyLog.aggregate([{ $match: f.study }, { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, minutes: { $sum: '$durationMinutes' } } }, { $sort: { _id: 1 } }]),
    StudyLog.aggregate([{ $match: f.study }, { $group: { _id: { y: { $isoWeekYear: '$date' }, w: { $isoWeek: '$date' } }, minutes: { $sum: '$durationMinutes' } } }, { $sort: { '_id.y': 1, '_id.w': 1 } }]),
    StudyLog.aggregate([{ $match: f.study }, { $group: { _id: '$subject', minutes: { $sum: '$durationMinutes' } } },
      { $lookup: { from: 'subjects', localField: '_id', foreignField: '_id', as: 's' } }, { $unwind: '$s' }, { $project: { _id: 0, name: '$s.name', code: '$s.code', minutes: 1 } }, { $sort: { minutes: -1 } }]),
    StudyTask.aggregate([{ $match: f.task }, { $group: { _id: '$status', n: { $sum: 1 }, overdue: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'Completed'] }, { $lt: ['$dueDate', new Date()] }] }, 1, 0] } } } }])
  ]);

  // Attendance by subject
  const am = new Map();
  attAgg.forEach((r) => {
    const k = String(r._id.subject);
    if (!am.has(k)) am.set(k, { subjectId: k, name: r.s.name, code: r.s.code, counts: {} });
    am.get(k).counts[r._id.status] = r.n;
  });
  const attendanceBySubject = [...am.values()].map((s) => {
    const a = calcAttendance(s.counts);
    return { subjectId: s.subjectId, name: s.name, code: s.code, ...a, classesNeeded: classesNeeded(a.attended, a.total, target) };
  }).sort((a, b) => (a.percentage ?? 101) - (b.percentage ?? 101));
  const totAtt = attendanceBySubject.reduce((t, s) => ({ attended: t.attended + s.attended, total: t.total + s.total }), { attended: 0, total: 0 });

  const tasks = { Pending: 0, 'In Progress': 0, Completed: 0, overdue: 0 };
  taskAgg.forEach((t) => { tasks[t._id] = t.n; tasks.overdue += t.overdue; });
  const taskTotal = tasks.Pending + tasks['In Progress'] + tasks.Completed;

  const totalMinutes = studyDay.reduce((s, d) => s + d.minutes, 0);
  const now = Date.now(), dayMs = 86400000;
  const sumSince = (days) => studyDay.filter((d) => new Date(d._id).getTime() >= now - days * dayMs).reduce((s, d) => s + d.minutes, 0);

  return {
    attendanceTarget: target,
    overallAverage: subjAgg.length ? mean(subjAgg.map((s) => s.average)) : null, // mean of subject averages
    overallAttendance: totAtt.total > 0 ? round2((totAtt.attended / totAtt.total) * 100) : null,
    recordCount: subjAgg.reduce((s, x) => s + x.count, 0),
    subjectPerformance: subjAgg,
    weakSubjects: subjAgg.filter((s) => s.average < require('../config/riskConfig').recommendations.weakSubjectBelow),
    trend: trendAgg,
    attendanceBySubject,
    study: {
      totalMinutes, last7Minutes: sumSince(7), last30Minutes: sumSince(30),
      byDay: studyDay.map((d) => ({ date: d._id, minutes: d.minutes })),
      byWeek: studyWeek.map((w) => ({ week: `${w._id.y}-W${String(w._id.w).padStart(2, '0')}`, minutes: w.minutes })),
      bySubject: studySubj
    },
    tasks: { ...tasks, total: taskTotal, completionRate: taskTotal ? round2((tasks.Completed / taskTotal) * 100) : null }
  };
}

module.exports = { percentage, calcAttendance, classesNeeded, formatMinutes, subjectAverages, mean, round2, loadStudentData, getSummary };
