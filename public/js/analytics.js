$(function () {
  EDU.init({ title: 'Analytics' }).done(() => {
    const staff = EDU.isStaff();
    const reqs = [EDU.get('/api/subjects', { limit: 200 })];
    if (staff) { $('#stuWrap').show(); reqs.push(EDU.get('/api/students', { limit: 100 })); }
    $.when.apply($, reqs).done((sr, stu) => {
      sr[0].data.forEach((s) => $('#fSubject').append(`<option value="${s._id}">${EDU.esc(s.code)} — ${EDU.esc(s.name)}</option>`));
      for (let i = 1; i <= 8; i++) $('#fSemester').append(`<option>${i}</option>`);
      if (stu) stu[0].data.forEach((s) => $('#fStudent').append(`<option value="${s._id}">${EDU.esc(s.studentId)} ${EDU.esc(s.user ? s.user.name : '')}</option>`));
      const types = staff ? ['academic', 'attendance', 'subject-averages', 'attendance-summary', 'study-summary', 'risk'] : ['subject-averages', 'attendance-summary', 'study-summary', 'academic', 'attendance', 'tasks', 'recommendations'];
      const names = { academic: 'Academic records', attendance: 'Attendance records', 'subject-averages': 'Subject averages', 'attendance-summary': 'Attendance summary', 'study-summary': 'Study hours', risk: 'Risk (advisory)', tasks: 'Task completion', recommendations: 'Recommendations' };
      $('#reportBtns').html(types.map((t) => `<button class="btn btn-outline-secondary btn-sm" data-r="${t}"><i class="bi bi-download"></i> ${names[t]}</button>`).join(''));
      $('#reportBtns').on('click', '[data-r]', function () { EDU.downloadCsv($(this).data('r'), params()); });
      load();
    });

    function params() {
      const p = { from: $('#fFrom').val(), to: $('#fTo').val(), subject: $('#fSubject').val(), semester: $('#fSemester').val(), assessmentType: $('#fType').val(), studentId: $('#fStudent').val() };
      Object.keys(p).forEach((k) => { if (!p[k]) delete p[k]; });
      return p;
    }
    function load() {
      const p = params(), $btn = $('#applyBtn').prop('disabled', true);
      $('#cards').html('<div class="col-12"><div class="loading"><div class="spinner-border spinner-border-sm"></div> Loading analytics…</div></div>');
      $.when(EDU.get('/api/analytics/performance', p), EDU.get('/api/analytics/attendance', p), EDU.get('/api/analytics/productivity', p)).done((a, b, c) => {
        const perf = a[0].data, att = b[0].data, prod = c[0].data, t = prod.tasks, st = prod.study;
        $('#cards').html(EDU.statCard('bi-journal-check', 'blue', EDU.fmt.pct(perf.overallAverage), 'Overall average (avg of subjects)', 'col-6 col-lg-3') +
          EDU.statCard('bi-calendar-check', 'teal', att.overallAttendance === null ? 'N/A' : EDU.fmt.pct(att.overallAttendance), att.overallAttendance === null ? 'Insufficient attendance data' : `Attendance (target ${att.target}%)`, 'col-6 col-lg-3') +
          EDU.statCard('bi-clock-history', 'amber', EDU.fmt.mins(st.totalMinutes), 'Study time recorded', 'col-6 col-lg-3') +
          EDU.statCard('bi-exclamation-triangle', 'red', perf.weakSubjects.length, 'Subjects needing attention', 'col-6 col-lg-3'));

        const sp = perf.subjectPerformance;
        EDU.chart('perfChart', { type: 'bar', data: { labels: sp.map((s) => s.code), datasets: [{ label: 'Average %', data: sp.map((s) => s.average), backgroundColor: sp.map((s) => (s.average < 60 ? '#ef4444' : '#2563eb')), borderRadius: 6 }] },
          options: { scales: { y: { min: 0, max: 100 } }, plugins: { tooltip: { callbacks: { title: (i) => sp[i[0].dataIndex].name, afterLabel: (i) => `${sp[i.dataIndex].count} assessment(s)` } } } } }, sp.length > 0);

        const tr = perf.trend, single = perf.trendMode === 'assessment';
        EDU.chart('trendChart', { type: 'line', data: { labels: tr.map((x) => (single ? `${EDU.fmt.date(x.date)} ${x.label}` : x.label)), datasets: [{ label: single ? 'Assessment %' : 'Monthly average %', data: tr.map((x) => x.percentage), borderColor: '#0d9488', backgroundColor: 'rgba(13,148,136,.15)', fill: true, tension: .25, pointRadius: 4 }] },
          options: { scales: { y: { min: 0, max: 100 } }, plugins: { tooltip: { callbacks: { afterLabel: (i) => (single && tr[i.dataIndex].subject ? tr[i.dataIndex].subject : '') } } } } }, tr.length > 0);

        const ab = att.attendanceBySubject.filter((s) => s.percentage !== null);
        EDU.chart('attChart', { type: 'bar', data: { labels: ab.map((s) => s.code), datasets: [{ label: 'Attendance %', data: ab.map((s) => s.percentage), backgroundColor: ab.map((s) => (s.percentage < att.target ? '#f59e0b' : '#0d9488')), borderRadius: 6 }, { type: 'line', label: `Target ${att.target}%`, data: ab.map(() => att.target), borderColor: '#ef4444', borderDash: [6, 4], pointRadius: 0 }] },
          options: { scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: true } } } }, ab.length > 0);

        EDU.chart('studyChart', { type: 'line', data: { labels: st.byDay.map((d) => d.date), datasets: [{ label: 'Minutes', data: st.byDay.map((d) => d.minutes), borderColor: '#8b5cf6', backgroundColor: 'rgba(139,92,246,.15)', fill: true, tension: .25 }] } }, st.byDay.length > 0);

        const open = t.Pending + t['In Progress'], pend = Math.max(open - t.overdue, 0);
        EDU.chart('taskChart', { type: 'doughnut', data: { labels: ['Completed', 'Pending / in progress', 'Overdue'], datasets: [{ data: [t.Completed, pend, t.overdue], backgroundColor: ['#16a34a', '#2563eb', '#ef4444'] }] } }, t.total > 0);
      }).fail((x) => $('#cards').html(`<div class="col-12"><div class="alert alert-danger">${EDU.esc(EDU.err(x))}</div></div>`)).always(() => $btn.prop('disabled', false));
    }
    $('#applyBtn').on('click', () => {
      if ($('#fFrom').val() && $('#fTo').val() && $('#fFrom').val() > $('#fTo').val()) return EDU.toast('"From" date must be before "To" date.', 'warning');
      load();
    });
    $('#resetBtn').on('click', () => { $('#fFrom,#fTo,#fSubject,#fSemester,#fType,#fStudent').val(''); load(); });
  });
});
