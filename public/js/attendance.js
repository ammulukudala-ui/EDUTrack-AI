$(function () {
  EDU.init({ title: 'Attendance' }).done(() => {
    const staff = EDU.isStaff(), STAT = ['Present', 'Absent', 'Late', 'Excused'];
    const reqs = [EDU.get('/api/subjects', { limit: 200 })];
    if (staff) reqs.push(EDU.get('/api/students', { limit: 100 }));
    $.when.apply($, reqs).done((sr, stu) => {
      const subjects = sr[0].data, students = stu ? stu[0].data : [];
      const filters = [{ name: 'subject', type: 'select', label: 'Subject', options: subjects.map((s) => ({ value: s._id, label: `${s.code} ${s.name}` })) }];
      if (staff) filters.push({ name: 'student', type: 'select', label: 'Student', options: students.map((s) => ({ value: s._id, label: `${s.studentId} ${s.user ? s.user.name : ''}` })) });
      filters.push({ name: 'status', type: 'select', label: 'Status', options: STAT }, { name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' });
      const kind = { Present: 'success', Absent: 'danger', Late: 'warning', Excused: 'info' };
      EDU.crud({
        el: '#crud', endpoint: '/api/attendance', title: staff ? 'Attendance records' : 'My attendance', singular: 'Attendance', empty: 'No attendance records found.', report: 'attendance',
        columns: [...(staff ? [{ label: 'Student', render: (r) => `${EDU.esc(r.student.studentId)}<br><small class="text-muted">${EDU.esc(r.student.user ? r.student.user.name : '')}</small>` }] : []),
          { label: 'Subject', render: (r) => EDU.esc(r.subject.name) }, { label: 'Date', render: (r) => EDU.fmt.date(r.date) },
          { label: 'Status', render: (r) => EDU.badge(r.status, kind[r.status]) }, { label: 'Remarks', render: (r) => EDU.esc(r.remarks || '') }],
        filters, canCreate: staff, canEdit: () => staff, canDelete: () => staff, limit: 15,
        onLoad: (r) => {
          const s = r.summary, low = s.percentage !== null && s.percentage < s.target;
          $('#attCards').html(
            EDU.statCard('bi-percent', low ? 'red' : 'teal', s.percentage === null ? 'N/A' : s.percentage.toFixed(1) + '%', s.percentage === null ? 'Insufficient attendance data' : 'Attendance (filtered view)', 'col-6 col-lg-3') +
            EDU.statCard('bi-check2-circle', 'blue', `${s.attended} / ${s.total}`, 'Attended / counted classes', 'col-6 col-lg-3') +
            EDU.statCard('bi-bullseye', 'amber', s.target + '%', 'Target (configurable)', 'col-6 col-lg-3') +
            EDU.statCard('bi-arrow-up-right-circle', 'violet', s.percentage === null ? '—' : (s.classesNeeded === 0 ? 'Target met' : s.classesNeeded === null ? 'n/a' : s.classesNeeded), 'More classes needed to reach target', 'col-6 col-lg-3'));
        },
        fields: [
          { name: 'subject', label: 'Subject', type: 'select', required: true, options: subjects.map((s) => ({ value: s._id, label: `${s.code} — ${s.name}` })) },
          { name: 'student', label: 'Student', type: 'select', required: true, options: [] },
          { name: 'date', label: 'Date', type: 'date', required: true, default: EDU.today() }, { name: 'status', label: 'Status', type: 'select', required: true, options: STAT },
          { name: 'remarks', label: 'Remarks (optional)', type: 'textarea', col: 'col-12' }],
        toForm: (r) => ({ subject: r.subject._id, student: r.student._id, date: EDU.fmt.date(r.date), status: r.status, remarks: r.remarks || '' }),
        onOpen: ($f, row) => {
          const $sub = $f.find('[name=subject]'), $stu = $f.find('[name=student]');
          $f.off('change.dep').on('change.dep', '[name=subject]', () => EDU.fillStudents($stu, $sub.val()));
          EDU.fillStudents($stu, row ? row.subject._id : $sub.val(), row ? row.student._id : null);
        }
      });
    });
  });
});
