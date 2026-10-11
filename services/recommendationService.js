/**
 * Deterministic, explainable recommendation engine (no paid AI API needed).
 * Each recommendation carries an "explanation" showing WHY it was produced.
 * Designed so a future ML/LLM model could replace buildRecommendations() with the same output shape.
 */
const defaultCfg = require('../config/riskConfig');
const { subjectAverages, mean, formatMinutes } = require('./analyticsService');

function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - y0) / 86400000 + 1) / 7)).padStart(2, '0')}`;
}
const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);
const PRI = { High: 0, Medium: 1, Low: 2 };

function buildRecommendations(data, cfg = defaultCfg, now = new Date()) {
  const rc = cfg.recommendations, target = cfg.attendanceTarget, wk = isoWeekKey(now), out = [];
  const recs = (data.records || []).filter((r) => r.percentage != null).sort((a, b) => new Date(a.date) - new Date(b.date));
  const tasks = data.tasks || [], logs = data.studyLogs || [], attendance = data.attendanceBySubject || [];
  const day = 86400000;

  const subj = subjectAverages(recs);
  subj.filter((s) => s.average < rc.weakSubjectBelow && s.count >= rc.minRecordsPerSubject).slice(0, 3).forEach((s) => {
    const lowest = recs.filter((r) => r.subjectId === s.subjectId).sort((a, b) => a.percentage - b.percentage)[0];
    out.push({ key: `weak-subject:${s.subjectId}:${wk}`, type: 'weak-subject', subject: s.subjectId, priority: s.average < 50 ? 1 : 2,
      title: `Give extra time to ${s.name}`,
      explanation: `Your average in ${s.name} is ${s.average}% across ${s.count} recorded assessment(s), below the ${rc.weakSubjectBelow}% attention level. Lowest result: ${lowest.name} (${lowest.percentage}%).`,
      action: `Consider scheduling two revision sessions for ${s.name} this week, starting with the topics from "${lowest.name}".` });
  });

  attendance.filter((a) => a.total >= rc.minAttendanceSessions && a.percentage != null && a.percentage < target).forEach((a) => {
    const need = require('./analyticsService').classesNeeded(a.attended, a.total, target);
    out.push({ key: `attendance:${a.subjectId}:${wk}`, type: 'attendance', subject: a.subjectId, priority: 1,
      title: `Attendance in ${a.name} is below target`,
      explanation: `Attendance in ${a.name} is ${a.percentage}% (${a.attended} of ${a.total} counted classes) compared with the target of ${target}%.`,
      action: need ? `Attending about ${need} more consecutive class(es) would reach ${target}%. Speak to your faculty if attending is difficult.` : 'Review the attendance summary and consult your faculty.' });
  });

  const open = tasks.filter((t) => t.status !== 'Completed');
  const overdue = open.filter((t) => new Date(t.dueDate) < now);
  const soon = open.filter((t) => { const d = new Date(t.dueDate); return d >= now && d <= new Date(now.getTime() + rc.dueSoonDays * day); })
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate) || PRI[a.priority] - PRI[b.priority]);
  if (overdue.length) out.push({ key: `overdue:${wk}`, type: 'overdue', priority: 1, title: `${overdue.length} overdue task(s)`,
    explanation: `${overdue.length} task(s) passed their due date without being completed (oldest: "${overdue.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0].title}").`,
    action: 'Pick the most important overdue task, finish or reschedule it, and update its status.' });
  if (soon.length) out.push({ key: `tasks-soon:${wk}`, type: 'tasks', priority: 2, title: `${soon.length} task(s) due within ${rc.dueSoonDays} days`,
    explanation: `You have ${soon.length} open task(s) due in the next ${rc.dueSoonDays} days.`,
    action: `Start with "${soon[0].title}" (due ${fmtDate(soon[0].dueDate)}), then continue in deadline order.` });

  if (recs.length >= 4) {
    const recent = mean(recs.slice(-3).map((r) => r.percentage)), earlier = mean(recs.slice(0, -3).map((r) => r.percentage));
    if (earlier - recent >= rc.trendDrop) out.push({ key: `trend:${wk}`, type: 'trend', priority: 2, title: 'Recent marks are lower than earlier results',
      explanation: `Your latest 3 assessments average ${recent}% compared with ${earlier}% earlier.`,
      action: `Review the topics covered in "${recs[recs.length - 1].name}" (${recs[recs.length - 1].subjectName}) and ask for feedback if anything is unclear.` });
  }

  const recentLogs = logs.filter((l) => new Date(l.date) >= new Date(now.getTime() - rc.noStudyLogDays * day));
  const hasAny = recs.length || attendance.length || tasks.length || logs.length;
  if (hasAny && (!logs.length || !recentLogs.length)) out.push({ key: `study-habit:${wk}`, type: 'study-habit', priority: 3, title: 'Track your study sessions',
    explanation: `No study sessions were logged in the last ${rc.noStudyLogDays} days.`,
    action: 'Log each study session (subject, topic, minutes) so you can see where your time goes.' });
  else if (subj[0] && subj[0].average < rc.weakSubjectBelow) {
    const mins = logs.filter((l) => String(l.subject._id) === subj[0].subjectId && new Date(l.date) >= new Date(now.getTime() - 14 * day)).reduce((s, l) => s + l.durationMinutes, 0);
    if (mins < rc.lowStudyMinutes14d) out.push({ key: `study-time:${subj[0].subjectId}:${wk}`, type: 'study-time', subject: subj[0].subjectId, priority: 2,
      title: `Plan study blocks for ${subj[0].name}`,
      explanation: `Only ${formatMinutes(mins)} of study was logged for ${subj[0].name} in the last 14 days, while its average is ${subj[0].average}%. Study time is shown next to marks for awareness; it does not by itself determine results.`,
      action: `Consider adding short, focused study blocks for ${subj[0].name} to your planner.` });
  }

  if (!recs.length && !attendance.length && !logs.length && !tasks.length) out.push({ key: `getting-started:${wk}`, type: 'getting-started', priority: 3,
    title: 'Add your academic information', explanation: 'No marks, attendance, study sessions or tasks have been recorded yet, so personal suggestions cannot be made.',
    action: 'Add study sessions and tasks, and ask your faculty about recorded marks and attendance.' });
  else if (!out.length) out.push({ key: `maintain:${wk}`, type: 'maintain', priority: 3, title: 'Keep up your routine',
    explanation: 'No concerns were found in your recorded marks, attendance or tasks this week.', action: 'Continue tracking your study sessions and plan revision before your next assessment.' });

  return out.sort((a, b) => a.priority - b.priority);
}

async function generateFor(studentId, now = new Date()) {
  const Recommendation = require('../models/Recommendation');
  const { loadStudentData } = require('./analyticsService');
  const items = buildRecommendations(await loadStudentData(studentId), defaultCfg, now);
  for (const it of items) {
    const existing = await Recommendation.findOne({ student: studentId, key: it.key });
    if (!existing) await Recommendation.create({ ...it, student: studentId });
    else if (existing.status === 'Active') { Object.assign(existing, { title: it.title, explanation: it.explanation, action: it.action, priority: it.priority }); await existing.save(); }
    // Completed/Dismissed ones are respected and not re-created this week
  }
  return Recommendation.find({ student: studentId, status: 'Active' }).populate('subject', 'name code').sort({ priority: 1, createdAt: -1 });
}

module.exports = { buildRecommendations, generateFor, isoWeekKey };
