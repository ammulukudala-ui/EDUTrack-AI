// Central place for simple application settings.
module.exports = {
  ASSESSMENT_TYPES: ['Internal Examination', 'Assignment', 'Quiz', 'Practical', 'Semester Examination'],
  ATTENDANCE_STATUSES: ['Present', 'Absent', 'Late', 'Excused'],
  TASK_PRIORITIES: ['Low', 'Medium', 'High'],
  TASK_STATUSES: ['Pending', 'In Progress', 'Completed'],
  ROLES: ['student', 'faculty', 'admin'],
  ROLE_HOME: { student: '/student-dashboard.html', faculty: '/faculty-dashboard.html', admin: '/admin-dashboard.html' },
  // Attendance target in percent. Every college is different, so it is configurable.
  get attendanceTarget() { return Number(process.env.ATTENDANCE_TARGET) || 75; },
  // A subject whose average is below this percentage is flagged as "needs attention".
  get weakSubjectThreshold() { return Number(process.env.WEAK_SUBJECT_THRESHOLD) || 50; },
  get sessionMaxAgeMs() { return (Number(process.env.SESSION_HOURS) || 2) * 60 * 60 * 1000; }
};
