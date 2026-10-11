/**
 * ALL risk-score settings live here (weights, thresholds, categories).
 * The score is ADVISORY. It is a transparent rule-based calculation,
 * NOT a trained machine-learning model.
 *
 * Score meaning: 0 = no risk indicators found, 100 = every indicator is at its worst.
 * Higher score = more indicators that extra academic support may help.
 */
module.exports = {
  version: 'rules-1.0',

  // Attendance target in percent (can be overridden by ATTENDANCE_TARGET in .env)
  attendanceTarget: Number(process.env.ATTENDANCE_TARGET) || 75,

  // Maximum points each factor can add (they are normalised to 0-100 over available factors)
  weights: { performance: 40, attendance: 30, trend: 20, tasks: 10 },

  // Minimum data needed before a score is calculated
  minimum: {
    academicRecords: 3,    // REQUIRED: fewer records -> "insufficient data", no score
    attendanceSessions: 5, // optional factor: used only if at least this many sessions exist
    trendRecords: 5,       // optional factor: needs enough records to compare recent vs earlier
    tasks: 3               // optional factor: needs this many due/completed tasks
  },

  performance: { goodAt: 75, worstAt: 35 },   // avg % >= 75 -> 0 risk; avg % <= 35 -> full risk
  attendance: { gapForFullRisk: 30 },          // target-30 points or lower -> full risk
  trend: { recentCount: 3, dropForFullRisk: 20 }, // recent avg is 20 points below earlier avg -> full risk

  // Category ranges (inclusive upper bound)
  categories: [
    { name: 'Low Risk', max: 33 },
    { name: 'Moderate Risk', max: 66 },
    { name: 'High Risk', max: 100 }
  ],

  // Recommendation engine thresholds
  recommendations: {
    weakSubjectBelow: 60,     // subject average (%) under this is "needs attention"
    minRecordsPerSubject: 1,
    minAttendanceSessions: 3,
    dueSoonDays: 3,
    trendDrop: 10,
    noStudyLogDays: 7,
    lowStudyMinutes14d: 60
  }
};
