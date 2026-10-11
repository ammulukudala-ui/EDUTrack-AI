$(function () {
  EDU.init({ title: 'Risk & Recommendations' }).done(() => {
    if (EDU.user.role === 'student') studentView(); else staffView();
  });

  /* ---------------- STUDENT ---------------- */
  function studentView() {
    $('#studentView').show();
    const sid = EDU.student._id;
    const icon = { 'weak-subject': 'bi-book', attendance: 'bi-calendar-x', tasks: 'bi-list-task', overdue: 'bi-alarm', trend: 'bi-graph-down', 'study-habit': 'bi-clock-history', 'study-time': 'bi-hourglass-split', maintain: 'bi-emoji-smile', 'getting-started': 'bi-rocket' };
    const kind = { Active: 'primary', Completed: 'success', Dismissed: 'secondary' };

    function loadRisk() {
      EDU.loading('#riskBox');
      EDU.get('/api/risk/my-assessment').done((r) => $('#riskBox').html(EDU.riskDetail(r.data))).fail((x) => EDU.errorBox('#riskBox', x));
      EDU.get(`/api/risk/history/${sid}`).done((r) => {
        const rows = r.data.filter((x) => x.status === 'ok').reverse();
        EDU.chart('histChart', { type: 'line', data: { labels: rows.map((x) => EDU.fmt.date(x.assessedAt)), datasets: [{ label: 'Advisory score', data: rows.map((x) => x.score), borderColor: '#2563eb', tension: .25 }] }, options: { scales: { y: { min: 0, max: 100 } } } }, rows.length > 0);
      });
    }
    function loadRecs() {
      EDU.loading('#recList');
      EDU.get('/api/recommendations', { studentId: sid, status: $('#recStatus').val(), limit: 50 }).done((r) => {
        if (!r.data.length) return EDU.empty('#recList', 'No recommendations here yet. Click “Generate recommendations” to analyse your latest records.', 'bi-lightbulb');
        $('#recList').html(r.data.map((x) => `<div class="card mb-2" data-id="${x._id}"><div class="card-body py-3"><div class="d-flex justify-content-between gap-2"><div class="d-flex gap-3"><div class="stat-icon bg-i-teal"><i class="bi ${icon[x.type] || 'bi-lightbulb'}"></i></div>
          <div><h6 class="mb-1">${EDU.esc(x.title)} ${EDU.badge(x.status, kind[x.status])}</h6><div class="small text-muted mb-1"><b>Why:</b> ${EDU.esc(x.explanation)}</div><div class="small"><b>Suggested action:</b> ${EDU.esc(x.action)}</div></div></div>
          <div class="text-nowrap">${x.status === 'Active' ? '<button class="btn btn-sm btn-success me-1" data-s="Completed"><i class="bi bi-check2"></i> Done</button><button class="btn btn-sm btn-outline-secondary" data-s="Dismissed">Dismiss</button>' : '<button class="btn btn-sm btn-outline-primary me-1" data-s="Active">Reopen</button><button class="btn btn-sm btn-outline-danger" data-s="remove"><i class="bi bi-trash"></i></button>'}</div></div></div></div>`).join(''));
      }).fail((x) => EDU.errorBox('#recList', x));
    }
    $('#recList').on('click', '[data-s]', function () {
      const id = $(this).closest('[data-id]').data('id'), s = $(this).data('s'), $b = $(this).prop('disabled', true);
      const call = s === 'remove' ? EDU.del(`/api/recommendations/${id}`) : EDU.put(`/api/recommendations/${id}`, { status: s });
      call.done((r) => { EDU.toast(r.message, 'success'); loadRecs(); }).fail((x) => { EDU.toast(EDU.err(x), 'error'); $b.prop('disabled', false); });
    });
    $('#recStatus').on('change', loadRecs);
    $('#genBtn').on('click', function () {
      const $b = $(this).prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Analysing…');
      EDU.post('/api/recommendations/generate').done((r) => { EDU.toast(r.message, 'success'); $('#recStatus').val('Active'); loadRecs(); loadRisk(); })
        .fail((x) => EDU.toast(EDU.err(x), 'error')).always(() => $b.prop('disabled', false).html('<i class="bi bi-magic"></i> Generate recommendations'));
    });
    loadRisk(); loadRecs();
  }

  /* ---------------- FACULTY / ADMIN ---------------- */
  function staffView() {
    $('#staffView').show();
    let tm; const rows = {};
    function loadCohort() {
      $('#cBody').html('<tr><td colspan="6"><div class="loading"><div class="spinner-border spinner-border-sm"></div> Calculating advisory scores…</div></td></tr>');
      EDU.get('/api/analytics/cohort', { limit: 50, category: $('#cCat').val(), q: $('#cQ').val() }).done((r) => {
        if (!r.data.length) return $('#cBody').html('<tr><td colspan="6"><div class="empty"><i class="bi bi-people"></i>No students found.</div></td></tr>');
        r.data.forEach((s) => { rows[s.id] = s; });
        $('#cBody').html(r.data.map((s) => `<tr><td><b>${EDU.esc(s.name)}</b><br><small class="text-muted">${EDU.esc(s.studentId)}</small></td><td>${EDU.esc(s.department)} / ${s.semester}</td><td>${EDU.fmt.pct(s.overallAverage)}</td><td>${s.attendancePct === null ? '<small class="text-muted">Insufficient data</small>' : EDU.fmt.pct(s.attendancePct)}</td><td>${EDU.riskBadge(s)}</td><td><button class="btn btn-sm btn-outline-primary" data-id="${s.id}">Details</button></td></tr>`).join(''));
      }).fail((x) => $('#cBody').html(`<tr><td colspan="6"><div class="alert alert-danger m-2">${EDU.esc(EDU.err(x))}</div></td></tr>`));
    }
    $('#cCat').on('change', loadCohort);
    $('#cQ').on('input', () => { clearTimeout(tm); tm = setTimeout(loadCohort, 400); });
    $('#cBody').on('click', '[data-id]', function () { detail($(this).data('id')); $('html,body').animate({ scrollTop: $('#detail').offset().top - 20 }, 300); });

    function detail(id) {
      $('#detail').html('<div class="card"><div class="card-body"><div class="loading"><div class="spinner-border spinner-border-sm"></div> Loading student…</div></div></div>');
      $.when(EDU.get(`/api/risk/students/${id}`), EDU.get(`/api/risk/history/${id}`), EDU.get('/api/analytics/dashboard', { studentId: id }), EDU.get(`/api/students/${id}`)).done((rk, hs, dash, stu) => {
        const s = stu[0].data, d = dash[0].data, hist = hs[0].data.filter((x) => x.status === 'ok').reverse();
        $('#detail').html(`<div class="card"><div class="card-header">${EDU.esc(s.user ? s.user.name : '')} · ${EDU.esc(s.studentId)} · ${EDU.esc(s.department)} sem ${s.semester}</div><div class="card-body"><div class="row g-3">
          <div class="col-lg-5">${EDU.riskDetail(rk[0].data)}${rk[0].restrictedToSubjects ? '<p class="small text-muted mt-2">Score is calculated from all of the student’s records; detailed marks below are limited to your subjects.</p>' : ''}</div>
          <div class="col-lg-7"><h6>Subject averages</h6><div class="chart-box" style="height:220px"><canvas id="dSubj"></canvas></div><h6 class="mt-3">Advisory score history</h6><div class="chart-box" style="height:200px"><canvas id="dHist"></canvas></div></div></div></div></div>`);
        EDU.chart('dSubj', { type: 'bar', data: { labels: d.subjectPerformance.map((x) => x.code), datasets: [{ label: 'Average %', data: d.subjectPerformance.map((x) => x.average), backgroundColor: '#2563eb', borderRadius: 6 }] }, options: { scales: { y: { min: 0, max: 100 } } } }, d.subjectPerformance.length > 0);
        EDU.chart('dHist', { type: 'line', data: { labels: hist.map((x) => EDU.fmt.date(x.assessedAt)), datasets: [{ label: 'Score', data: hist.map((x) => x.score), borderColor: '#0d9488', tension: .25 }] }, options: { scales: { y: { min: 0, max: 100 } } } }, hist.length > 0);
      }).fail((x) => $('#detail').html(`<div class="alert alert-danger">${EDU.esc(EDU.err(x))}</div>`));
    }
    loadCohort();
    const q = new URLSearchParams(location.search).get('student');
    if (q && /^[a-f0-9]{24}$/i.test(q)) detail(q);
  }
});
