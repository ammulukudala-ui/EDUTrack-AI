$(function () {
  EDU.init({ title: 'Academic Records' }).done(() => {
    const staff = EDU.isStaff(), TYPES = ['Internal Examination', 'Assignment', 'Quiz', 'Practical', 'Semester Examination'];
    const reqs = [EDU.get('/api/subjects', { limit: 200 })];
    if (staff) reqs.push(EDU.get('/api/students', { limit: 100 }));
    $.when.apply($, reqs).done((sr, stu) => {
      const subjects = sr[0].data, students = stu ? stu[0].data : [];
      const filters = [{ name: 'subject', type: 'select', label: 'Subject', options: subjects.map((s) => ({ value: s._id, label: `${s.code} ${s.name}` })) }];
      if (staff) filters.push({ name: 'student', type: 'select', label: 'Student', options: students.map((s) => ({ value: s._id, label: `${s.studentId} ${s.user ? s.user.name : ''}` })) });
      filters.push({ name: 'assessmentType', type: 'select', label: 'Type', options: TYPES }, { name: 'from', type: 'date', label: 'From date' }, { name: 'to', type: 'date', label: 'To date' });
      const bindDep = ($f, row) => {
        const $sub = $f.find('[name=subject]'), $stu = $f.find('[name=student]');
        $f.off('change.dep').on('change.dep', '[name=subject]', () => EDU.fillStudents($stu, $sub.val()));
        EDU.fillStudents($stu, row ? row.subject._id : $sub.val(), row ? row.student._id : null);
      };
      EDU.crud({
        el: '#crud', endpoint: '/api/academic-records', title: staff ? 'Academic records' : 'My marks and assessments', singular: 'Academic Record', empty: 'No academic records found for these filters.',
        report: 'academic',
        columns: [...(staff ? [{ label: 'Student', render: (r) => `${EDU.esc(r.student.studentId)}<br><small class="text-muted">${EDU.esc(r.student.user ? r.student.user.name : '')}</small>` }] : []),
          { label: 'Subject', render: (r) => EDU.esc(r.subject.name) }, { label: 'Assessment', render: (r) => `${EDU.esc(r.assessmentName)}<br><small class="text-muted">${EDU.esc(r.assessmentType)}</small>` },
          { label: 'Marks', render: (r) => `${r.marksObtained} / ${r.maxMarks}` },
          { label: '%', render: (r) => { const p = r.percentage; return p === null ? '—' : `<span class="badge ${p >= 75 ? 'risk-low' : p >= 50 ? 'risk-mod' : 'risk-high'}">${p.toFixed(1)}%</span>`; } },
          { label: 'Date', render: (r) => EDU.fmt.date(r.date) }],
        filters, canCreate: staff, canEdit: () => staff, canDelete: () => staff,
        summary: (r) => `Showing ${r.summary.count} record(s) · Average: <b>${r.summary.averagePercentage === null ? '—' : r.summary.averagePercentage + '%'}</b>`,
        fields: [
          { name: 'subject', label: 'Subject', type: 'select', required: true, options: subjects.map((s) => ({ value: s._id, label: `${s.code} — ${s.name}` })) },
          { name: 'student', label: 'Student (enrolled in subject)', type: 'select', required: true, options: [] },
          { name: 'assessmentName', label: 'Assessment name', required: true }, { name: 'assessmentType', label: 'Assessment type', type: 'select', required: true, options: TYPES },
          { name: 'marksObtained', label: 'Marks obtained', type: 'number', required: true, attrs: 'min="0" step="any"' }, { name: 'maxMarks', label: 'Maximum marks', type: 'number', required: true, attrs: 'min="1" step="any"' },
          { name: 'date', label: 'Assessment date', type: 'date', required: true, default: EDU.today() }, { name: 'remarks', label: 'Remarks (optional)', type: 'textarea', col: 'col-12' }],
        toForm: (r) => ({ subject: r.subject._id, student: r.student._id, assessmentName: r.assessmentName, assessmentType: r.assessmentType, marksObtained: r.marksObtained, maxMarks: r.maxMarks, date: EDU.fmt.date(r.date), remarks: r.remarks || '' }),
        onOpen: bindDep
      });
    });
  });
});
