/**
 * Academic Risk Analyzer - transparent RULE-BASED scoring (not machine learning).
 *
 * Each factor produces a "risk fraction" between 0 (no concern) and 1 (worst), which is multiplied
 * by the factor's weight (see config/riskConfig.js) to get its points.
 * Final score = (points earned / maximum points of the factors that HAD ENOUGH DATA) x 100, bounded 0-100.
 * If there are too few academic records, NO score is produced ("insufficient data").
 */
const defaultCfg = require('../config/riskConfig');
const { subjectAverages, mean, round2 } = require('./analyticsService');

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const DISCLAIMER = 'This score is advisory. It highlights where support may help and is not a prediction or a judgement about the student.';

function categoryFor(score, cfg) {
  const c = cfg.categories.find((x) => score <= x.max);
  return (c || cfg.categories[cfg.categories.length - 1]).name;
}

/**
 * @param data { records:[{percentage,date,subjectId,subjectName,name}], attendanceBySubject:[{attended,total}], tasks:[{status,dueDate}] }
 */
function assess(data, cfg = defaultCfg, now = new Date()) {
  const target = (cfg.attendanceTarget);
  const recs = (data.records || []).filter((r) => r.percentage != null).sort((a, b) => new Date(a.date) - new Date(b.date));
  const base = { algorithmVersion: cfg.version, disclaimer: DISCLAIMER, attendanceTarget: target };

  if (recs.length < cfg.minimum.academicRecords) {
    return {
      ...base, status: 'insufficient', score: null, category: null, factors: [], suggestedActions: [],
      missing: [`Academic records: at least ${cfg.minimum.academicRecords} are needed, ${recs.length} recorded`],
      dataCompleteness: 0, evidence: { recordCount: recs.length },
      explanation: 'Insufficient data: a risk score is not calculated until enough academic records exist. No conclusion should be drawn yet.'
    };
  }

  const w = cfg.weights, m = cfg.minimum;
  const factors = [], missing = [], actions = [], reasons = [];
  const evidence = { recordCount: recs.length };

  // 1) Academic performance (mean of subject averages)
  const subj = subjectAverages(recs);
  const overall = mean(subj.map((s) => s.average));
  evidence.overallAverage = overall;
  evidence.subjectAverages = subj.map((s) => ({ name: s.name, average: s.average, count: s.count }));
  const fPerf = clamp01((cfg.performance.goodAt - overall) / (cfg.performance.goodAt - cfg.performance.worstAt));
  factors.push({ key: 'performance', label: 'Academic performance', maxPoints: w.performance, points: round2(fPerf * w.performance),
    detail: `Average across subjects is ${overall}% (0 risk at ${cfg.performance.goodAt}%+, full risk at ${cfg.performance.worstAt}% or below).` });
  if (fPerf >= 0.34) {
    const weakest = subj[0];
    reasons.push(`overall marks are low (${overall}%)${weakest ? `, weakest subject: ${weakest.name} (${weakest.average}%)` : ''}`);
    if (weakest) actions.push(`Prioritise revision for ${weakest.name} and review the topics from its lowest assessment.`);
  }

  // 2) Attendance
  const att = (data.attendanceBySubject || []).reduce((t, s) => ({ a: t.a + s.attended, n: t.n + s.total }), { a: 0, n: 0 });
  if (att.n >= m.attendanceSessions) {
    const pct = round2((att.a / att.n) * 100);
    evidence.attendancePct = pct; evidence.attendanceSessions = att.n;
    const f = clamp01((target - pct) / cfg.attendance.gapForFullRisk);
    factors.push({ key: 'attendance', label: 'Attendance', maxPoints: w.attendance, points: round2(f * w.attendance),
      detail: `Attendance is ${pct}% over ${att.n} counted classes (target ${target}%).` });
    if (f > 0) { reasons.push(`attendance (${pct}%) is below the ${target}% target`); actions.push('Review the attendance summary and speak to your faculty mentor if attending is difficult.'); }
  } else missing.push(`Attendance: at least ${m.attendanceSessions} counted sessions are needed, ${att.n} recorded`);

  // 3) Recent trend (latest N assessments vs all earlier ones)
  if (recs.length >= m.trendRecords) {
    const n = cfg.trend.recentCount;
    const recent = mean(recs.slice(-n).map((r) => r.percentage)), earlier = mean(recs.slice(0, -n).map((r) => r.percentage));
    const drop = round2(earlier - recent);
    evidence.recentAverage = recent; evidence.earlierAverage = earlier;
    const f = clamp01(drop / cfg.trend.dropForFullRisk);
    factors.push({ key: 'trend', label: 'Recent performance trend', maxPoints: w.trend, points: round2(f * w.trend),
      detail: `Latest ${n} assessments average ${recent}% versus ${earlier}% earlier (${drop > 0 ? 'decline' : 'no decline'} of ${Math.max(drop, 0)} points).` });
    if (f > 0) { reasons.push(`recent marks (${recent}%) are lower than earlier results (${earlier}%)`); actions.push('Review the topics covered in your most recent assessments.'); }
  } else missing.push(`Trend: at least ${m.trendRecords} academic records are needed, ${recs.length} recorded`);

  // 4) Task completion (only tasks already due or completed are considered)
  const considered = (data.tasks || []).filter((t) => t.status === 'Completed' || new Date(t.dueDate) < now);
  if (considered.length >= m.tasks) {
    const done = considered.filter((t) => t.status === 'Completed').length;
    const rate = round2((done / considered.length) * 100);
    evidence.taskCompletionRate = rate;
    const f = clamp01(1 - done / considered.length);
    factors.push({ key: 'tasks', label: 'Study-task completion', maxPoints: w.tasks, points: round2(f * w.tasks),
      detail: `${done} of ${considered.length} due tasks completed (${rate}%).` });
    if (f >= 0.34) { reasons.push(`only ${rate}% of due study tasks are completed`); actions.push('Complete your earliest-deadline task first and break large tasks into smaller steps.'); }
  } else missing.push(`Task completion: at least ${m.tasks} due/completed tasks are needed, ${considered.length} available`);

  const available = factors.reduce((s, f) => s + f.maxPoints, 0);
  const earned = factors.reduce((s, f) => s + f.points, 0);
  const score = Math.max(0, Math.min(100, Math.round((earned / available) * 100)));
  const category = categoryFor(score, cfg);
  const completeness = Math.round((available / Object.values(w).reduce((a, b) => a + b, 0)) * 100);

  let explanation = reasons.length ? `${category}: ${reasons.join('; ')}.` : `${category}: no strong risk indicators were found in the available records.`;
  if (completeness < 100) explanation += ` This is based on partial data (${completeness}% complete).`;
  if (reasons.length) actions.push('Consider consulting your faculty mentor for support.');

  return { ...base, status: 'ok', score, category, factors, missing, dataCompleteness: completeness, evidence, suggestedActions: [...new Set(actions)], explanation };
}

/** Loads a student's data, assesses, and saves at most ONE dated assessment per day (no duplicates on refresh). */
async function assessStudent(studentId, { store = true, now = new Date(), subjectIds, scopeKey = 'full' } = {}) {
  const { loadStudentData } = require('./analyticsService');
  const RiskAssessment = require('../models/RiskAssessment');
  const result = assess(await loadStudentData(studentId, { subjectIds }), defaultCfg, now);
  if (store) {
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const doc = { student: studentId, scopeKey, status: result.status, score: result.score, category: result.category, factors: result.factors,
      missing: result.missing, dataCompleteness: result.dataCompleteness, explanation: result.explanation, algorithmVersion: result.algorithmVersion, assessedAt: now };
    await RiskAssessment.findOneAndUpdate({ student: studentId, scopeKey, assessedAt: { $gte: dayStart } }, doc, { upsert: true, new: true, setDefaultsOnInsert: true });
  }
  return { ...result, assessedAt: now };
}

// Admin/student assessments use ALL data ('full'). Faculty assessments only use their own subjects, stored separately.
const scopeKeyFor = (user) => (user.role === 'faculty' ? `faculty:${user._id}` : 'full');

module.exports = { assess, assessStudent, categoryFor, scopeKeyFor, DISCLAIMER };
