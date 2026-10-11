/* One script for the three dashboards (student / faculty / admin). Every number comes from the API. */
$(function () {
  const page = $('body').data('page');
  const role = page.split('-')[0];
  EDU.init({ roles: [role], title: { student: 'My Dashboard', faculty: 'Faculty Dashboard', admin: 'Admin Dashboard' }[role] }).done(() => ({ student, faculty, admin })[role]());

  const na = (v, f) => (v === null || v === undefined ? 'N/A' : f(v));
  const subjBar = (id, list) => EDU.chart(id, { type: 'bar', data: { labels: list.map((s) => s.code), datasets: [{ label: 'Average %', data: list.map((s) => s.average), backgroundColor: list.map((s) => (s.average < 60 ? '#ef4444' : '#2563eb')), borderRadius: 6 }] },
    options: { scales: { y: { min: 0, max: 100 } }, plugins: { tooltip: { callbacks: { title: (i) => list[i[0].dataIndex].name } } } } }, list.length > 0);
  const riskPie = (id, dist) => EDU.chart(id, { type: 'doughnut', data: { labels: Object.keys(dist), datasets: [{ data: Object.values(dist), backgroundColor: ['#22c55e', '#f59e0b', '#ef4444', '#94a3b8'] }] } }, Object.values(dist).some((v) => v > 0));

  /* ================= STUDENT ================= */
  function student() {
    const p = () => { const o = { from: $('#fFrom').val(), to: $('#fTo').val() }; Object.keys(o).forEach((k) => !o[k] && delete o[k]); return o; };
    function load() {
      $('#cards').html('<div class="col-12"><div class="loading"><div class="spinner-border spinner-border-sm"></div> Loading your data…</div></div>');
      EDU.get('/api/analytics/dashboard', p()).done((r) => {
        const d = r.data, t = d.tasks;
        $('#cards').html(EDU.statCard('bi-journal-check', 'blue', na(d.overallAverage, EDU.fmt.pct), 'Overall average marks') +
          EDU.statCard('bi-calendar-check', 'teal', d.overallAttendance === null ? 'N/A' : EDU.fmt.pct(d.overallAttendance), d.overallAttendance === null ? 'Insufficient attendance data' : `Average attendance (target ${d.attendanceTarget}%)`) +
          EDU.statCard('bi-clock-history', 'violet', EDU.fmt.mins(d.study.totalMinutes), 'Total study time') + EDU.statCard('bi-check2-square', 'green', t.Completed, 'Completed tasks') +
          EDU.statCard('bi-hourglass-split', 'amber', t.Pending + t['In Progress'], `Pending tasks${t.overdue ? ` (${t.overdue} overdue)` : ''}`) + EDU.statCard('bi-exclamation-triangle', 'red', d.weakSubjects.length, 'Subjects requiring attention'));
        subjBar('subjChart', d.subjectPerformance);
        EDU.chart('weekChart', { type: 'bar', data: { labels: d.study.byWeek.map((w) => w.week), datasets: [{ label: 'Hours', data: d.study.byWeek.map((w) => +(w.minutes / 60).toFixed(1)), backgroundColor: '#0d9488', borderRadius: 6 }] } }, d.study.byWeek.length > 0);
        const a = d.attendanceBySubject;
        if (!a.length) EDU.empty('#attBox', 'No attendance recorded yet.', 'bi-calendar-x');
        else $('#attBox').html('<ul class="list-group list-group-flush">' + a.map((s) => `<li class="list-group-item"><div class="d-flex justify-content-between small"><span>${EDU.esc(s.name)}</span><b>${s.percentage === null ? 'Insufficient data' : EDU.fmt.pct(s.percentage)}</b></div>${s.percentage === null ? '' : `<div class="progress" style="height:6px"><div class="progress-bar ${s.percentage < d.attendanceTarget ? 'bg-warning' : 'bg-success'}" style="width:${s.percentage}%"></div></div>`}${s.classesNeeded > 0 ? `<small class="text-muted">~${s.classesNeeded} more class(es) to reach ${d.attendanceTarget}%</small>` : ''}</li>`).join('') + '</ul>');
      }).fail((x) => $('#cards').html(`<div class="col-12"><div class="alert alert-danger">${EDU.esc(EDU.err(x))}</div></div>`));
    }
    load();
    $('#applyBtn').on('click', load); $('#resetBtn').on('click', () => { $('#fFrom,#fTo').val(''); load(); });

    EDU.loading('#riskBox');
    EDU.get('/api/risk/my-assessment').done((r) => $('#riskBox').html(EDU.riskDetail(r.data, true) + '<a class="btn btn-sm btn-outline-primary mt-2" href="/recommendations.html">Full explanation</a>')).fail((x) => EDU.errorBox('#riskBox', x));
    EDU.loading('#recBox');
    EDU.get('/api/recommendations', { studentId: EDU.student._id, status: 'Active', limit: 3 }).done((r) => {
      if (!r.data.length) return $('#recBox').html('<div class="empty"><i class="bi bi-lightbulb"></i>No active recommendations.<br><a href="/recommendations.html" class="btn btn-sm btn-teal mt-2">Generate</a></div>');
      $('#recBox').html(r.data.map((x) => `<div class="mb-3"><b class="small">${EDU.esc(x.title)}</b><div class="small text-muted">${EDU.esc(x.action)}</div></div>`).join(''));
    }).fail((x) => EDU.errorBox('#recBox', x));
    EDU.loading('#recentBox');
    EDU.get('/api/academic-records', { limit: 6 }).done((r) => {
      if (!r.data.length) return EDU.empty('#recentBox', 'No marks recorded yet. Your faculty will add them after assessments.', 'bi-journal');
      $('#recentBox').html('<table class="table table-sm mb-0"><thead><tr><th>Subject</th><th>Assessment</th><th>Marks</th><th>%</th><th>Date</th></tr></thead><tbody>' + r.data.map((x) => `<tr><td>${EDU.esc(x.subject.name)}</td><td>${EDU.esc(x.assessmentName)}</td><td>${x.marksObtained}/${x.maxMarks}</td><td>${EDU.fmt.pct(x.percentage)}</td><td>${EDU.fmt.date(x.date)}</td></tr>`).join('') + '</tbody></table>');
    }).fail((x) => EDU.errorBox('#recentBox', x));
    EDU.loading('#taskBox');
    EDU.get('/api/tasks', { status: 'open', limit: 6 }).done((r) => {
      if (!r.data.length) return EDU.empty('#taskBox', 'No open tasks. Add some in the Study Planner.', 'bi-list-check');
      $('#taskBox').html('<ul class="list-group list-group-flush">' + r.data.map((t) => { const od = new Date(t.dueDate) < new Date(); return `<li class="list-group-item d-flex justify-content-between"><span>${EDU.esc(t.title)}<br><small class="text-muted">${EDU.esc(t.subject ? t.subject.name : '')}</small></span><span class="${od ? 'overdue' : 'text-muted'} small text-nowrap">${EDU.fmt.date(t.dueDate)}${od ? '<br>overdue' : ''}</span></li>`; }).join('') + '</ul>');
    }).fail((x) => EDU.errorBox('#taskBox', x));
  }

  /* ================= FACULTY ================= */
  function faculty() {
    EDU.get('/api/subjects', { limit: 100 }).done((r) => r.data.forEach((s) => $('#cohortSubject').append(`<option value="${s._id}">${EDU.esc(s.code)} — ${EDU.esc(s.name)}</option>`)));
    EDU.get('/api/analytics/dashboard').done((r) => {
      const d = r.data; subjBar('subjChart', d.subjectPerformance);
      $('#avgCard').html('');
    });
    let tm;
    function cohort() {
      $('#cohortBody').html('<tr><td colspan="6"><div class="loading"><div class="spinner-border spinner-border-sm"></div> Calculating advisory scores…</div></td></tr>');
      return EDU.get('/api/analytics/cohort', { limit: 15, subject: $('#cohortSubject').val(), q: $('#cohortQ').val() }).done((r) => {
        const dist = r.distribution, support = dist['High Risk'] + dist['Moderate Risk'];
        $('#cards').html(EDU.statCard('bi-people', 'blue', r.totalStudents, 'Assigned students') + EDU.statCard('bi-database-check', 'teal', r.sufficientCount, 'With sufficient records') +
          EDU.statCard('bi-life-preserver', 'amber', support, 'May benefit from support') + EDU.statCard('bi-exclamation-octagon', 'red', dist['High Risk'], 'Higher advisory score') + EDU.statCard('bi-slash-circle', 'violet', dist['Insufficient data'], 'Insufficient data'));
        riskPie('riskChart', dist);
        if (!r.data.length) return $('#cohortBody').html('<tr><td colspan="6"><div class="empty"><i class="bi bi-people"></i>No students found for your subjects.</div></td></tr>');
        $('#cohortBody').html(r.data.map((s) => `<tr><td><b>${EDU.esc(s.name)}</b><br><small class="text-muted">${EDU.esc(s.studentId)}</small></td><td>${EDU.fmt.pct(s.overallAverage)}</td><td>${s.attendancePct === null ? '<small class="text-muted">Insufficient data</small>' : EDU.fmt.pct(s.attendancePct)}</td>
          <td>${EDU.riskBadge(s)}<div class="small text-muted mt-1" style="max-width:340px">${EDU.esc(s.explanation)}</div></td><td>${s.completeness}%</td><td><a class="btn btn-sm btn-outline-primary" href="/recommendations.html?student=${s.id}">Details</a></td></tr>`).join(''));
        $('#cohortInfo').text(`Showing top ${r.data.length} of ${r.pagination.total}. Scores are advisory and based on available records only.`);
      }).fail((x) => $('#cohortBody').html(`<tr><td colspan="6"><div class="alert alert-danger m-2">${EDU.esc(EDU.err(x))}</div></td></tr>`));
    }
    cohort();
    $('#cohortSubject').on('change', cohort); $('#cohortQ').on('input', () => { clearTimeout(tm); tm = setTimeout(cohort, 400); });
    $('#riskCsv').on('click', () => EDU.downloadCsv('risk', { subject: $('#cohortSubject').val() || undefined }));
  }

  /* ================= ADMIN ================= */
  function admin() {
    EDU.get('/api/admin/stats').done((r) => {
      const d = r.data;
      $('#cards').html(EDU.statCard('bi-people', 'blue', d.students, 'Active students') + EDU.statCard('bi-person-badge', 'teal', d.faculty, 'Faculty') + EDU.statCard('bi-book', 'violet', d.subjects, 'Subjects') +
        EDU.statCard('bi-journal-text', 'amber', d.records, 'Academic records') + EDU.statCard('bi-calendar-check', 'green', d.attendance, 'Attendance records') + EDU.statCard('bi-list-task', 'red', d.pendingTasks, 'Pending study tasks') +
        EDU.statCard('bi-percent', 'blue', na(d.averageMarks, EDU.fmt.pct), 'Average marks') + EDU.statCard('bi-bar-chart', 'teal', na(d.overallAttendance, EDU.fmt.pct), 'Overall attendance'));
      riskPie('riskChart', d.riskDistribution); $('#riskNote').text(d.riskNote + ' Advisory only.');
    }).fail((x) => $('#cards').html(`<div class="col-12"><div class="alert alert-danger">${EDU.esc(EDU.err(x))}</div></div>`));
    EDU.get('/api/analytics/dashboard').done((r) => subjBar('subjChart', r.data.subjectPerformance));

    EDU.crud({
      el: '#usersCrud', endpoint: '/api/admin/users', title: 'Users', singular: 'User', empty: 'No users found.',
      columns: [{ label: 'Name', key: 'name' }, { label: 'Email', key: 'email' }, { label: 'Role', render: (u) => EDU.badge(u.role, { admin: 'danger', faculty: 'primary', student: 'secondary' }[u.role]) },
        { label: 'Status', render: (u) => EDU.badge(u.active ? 'Active' : 'Deactivated', u.active ? 'success' : 'secondary') }, { label: 'Created', render: (u) => EDU.fmt.date(u.createdAt) }],
      filters: [{ name: 'q', type: 'search', label: 'Search name or email' }, { name: 'role', type: 'select', label: 'Role', options: ['student', 'faculty', 'admin'] }],
      canCreate: true, canEdit: () => true, canDelete: () => false,
      fields: [{ name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true, hideOnEdit: true },
        { name: 'role', label: 'Role', type: 'select', options: ['faculty', 'admin'], required: true, hideOnEdit: true }, { name: 'department', label: 'Department' },
        { name: 'password', label: 'Password (leave blank to keep)', type: 'password', attrs: 'autocomplete="new-password"' }, { name: 'active', label: 'Account active', type: 'checkbox', hideOnCreate: true }],
      toForm: (u) => ({ name: u.name, email: u.email, role: u.role, department: u.department || '', active: u.active })
    });
    let page = 1;
    function audit(reset) {
      if (reset) { page = 1; $('#auditBody').empty(); }
      EDU.get('/api/admin/audit', { page, limit: 20 }).done((r) => {
        $('#auditBody').append(r.data.map((a) => `<tr><td class="text-nowrap">${new Date(a.createdAt).toLocaleString()}</td><td>${EDU.esc(a.actorName || '')}</td><td><code>${EDU.esc(a.action)}</code></td><td>${EDU.esc(a.details || '')}</td></tr>`).join(''));
        $('#auditMore').toggle(page < r.pagination.pages); page++;
      }).fail((x) => EDU.toast(EDU.err(x), 'error'));
    }
    $('button[data-bs-target="#tabAudit"]').one('shown.bs.tab', () => audit(true));
    $('#auditMore').on('click', () => audit(false));
  }
});
