/* EDUTrack AI - shared helpers (jQuery). Every server call goes through EDU.api() which uses $.ajax(). */
window.EDU = (function ($) {
  const E = { user: null, student: null, csrf: null };

  /* ---------- CSRF token ---------- */
  E.csrfReady = $.get('/api/auth/csrf').done((r) => { E.csrf = r.token; });

  /* ---------- AJAX wrapper ---------- */
  E.api = function (method, url, data) {
    const isRead = method === 'GET';
    return E.csrfReady.then(() => $.ajax({
      method, url, dataType: 'json',
      data: isRead ? data : JSON.stringify(data || {}),
      contentType: isRead ? undefined : 'application/json',
      headers: E.csrf ? { 'X-CSRF-Token': E.csrf } : {}
    }));
  };
  E.get = (u, d) => E.api('GET', u, d);
  E.post = (u, d) => E.api('POST', u, d);
  E.put = (u, d) => E.api('PUT', u, d);
  E.del = (u) => E.api('DELETE', u);

  E.err = function (xhr) {
    if (!xhr || xhr.status === 0) return 'Cannot reach the server. Check your connection and that the server is running.';
    const j = xhr.responseJSON;
    return (j && j.message) || `Request failed (${xhr.status}).`;
  };
  // Global handler: expired session -> back to login
  $(document).ajaxError((e, xhr, s) => {
    if (xhr.status === 401 && !/\/api\/auth\/(login|register|me)/.test(s.url) && !/login|register|index/.test(location.pathname)) {
      location.href = '/login.html?expired=1';
    }
  });

  /* ---------- formatting ---------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  E.esc = esc;
  E.fmt = {
    date: (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—'),
    pct: (v) => (v === null || v === undefined ? '—' : `${(+v).toFixed(1)}%`),
    mins: (m) => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${r}m` : `${h}h`) : `${r}m`; }
  };
  E.riskBadge = (r) => {
    if (!r || r.status !== 'ok') return '<span class="badge risk-na">Insufficient data</span>';
    const cls = r.category === 'Low Risk' ? 'risk-low' : r.category === 'Moderate Risk' ? 'risk-mod' : 'risk-high';
    return `<span class="badge ${cls}">${esc(r.category)} · ${r.score}</span>`;
  };
  E.badge = (txt, kind) => `<span class="badge text-bg-${kind || 'secondary'}">${esc(txt)}</span>`;
  E.loading = (el) => $(el).html('<div class="loading"><div class="spinner-border spinner-border-sm text-primary"></div> Loading…</div>');
  E.empty = (el, msg, icon) => $(el).html(`<div class="empty"><i class="bi ${icon || 'bi-inbox'}"></i>${esc(msg)}</div>`);
  E.errorBox = (el, xhr) => $(el).html(`<div class="alert alert-danger m-3 mb-0">${esc(E.err(xhr))}</div>`);

  /* ---------- toast + confirm ---------- */
  E.toast = function (msg, type) {
    if (!$('#toasts').length) $('body').append('<div id="toasts" class="toast-container position-fixed top-0 end-0 p-3"></div>');
    const bg = { success: 'success', error: 'danger', info: 'primary', warning: 'warning' }[type || 'info'];
    const $t = $(`<div class="toast align-items-center text-bg-${bg} border-0" role="alert"><div class="d-flex"><div class="toast-body">${esc(msg)}</div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
    $('#toasts').append($t);
    const t = new bootstrap.Toast($t[0], { delay: 4200 }); t.show();
    $t.on('hidden.bs.toast', () => $t.remove());
  };
  E.confirm = function (msg, okText) {
    return new Promise((resolve) => {
      const $m = $(`<div class="modal fade" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><div class="modal-body p-4"><h5>Please confirm</h5><p class="mb-0">${esc(msg)}</p></div><div class="modal-footer"><button class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-danger ok">${esc(okText || 'Confirm')}</button></div></div></div></div>`);
      $('body').append($m);
      const modal = new bootstrap.Modal($m[0]); let result = false;
      $m.find('.ok').on('click', () => { result = true; modal.hide(); });
      $m.on('hidden.bs.modal', () => { $m.remove(); resolve(result); });
      modal.show();
    });
  };

  /* ---------- charts ---------- */
  const charts = {};
  E.chart = function (id, config, hasData) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
    const $c = $('#' + id), $wrap = $c.parent();
    $wrap.find('.empty').remove();
    if (!hasData) { $c.hide(); $wrap.append('<div class="empty"><i class="bi bi-bar-chart"></i>No data for the selected filters.</div>'); return; }
    $c.show();
    config.options = $.extend(true, { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: !!(config.data.datasets.length > 1 || config.type === 'doughnut') } } }, config.options || {});
    charts[id] = new Chart($c[0], config);
  };
  E.palette = ['#2563eb', '#0d9488', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#64748b'];

  /* ---------- CSV download via AJAX ---------- */
  E.downloadCsv = function (type, params) {
    return $.ajax({ url: `/api/reports/${type}`, data: params || {}, dataType: 'text' }).done((txt) => {
      const url = URL.createObjectURL(new Blob([txt], { type: 'text/csv;charset=utf-8' }));
      $('<a>').attr({ href: url, download: `edutrack-${type}-${new Date().toISOString().slice(0, 10)}.csv` }).appendTo('body')[0].click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      E.toast('Report downloaded.', 'success');
    }).fail((x) => E.toast(E.err(x), 'error'));
  };

  /* ---------- layout (sidebar + topbar) ---------- */
  const NAV = {
    student: [['student-dashboard.html', 'bi-speedometer2', 'Dashboard'], ['academic-records.html', 'bi-journal-check', 'My Marks'], ['attendance.html', 'bi-calendar-check', 'Attendance'], ['study-tracker.html', 'bi-clock-history', 'Study Tracker'], ['study-planner.html', 'bi-list-task', 'Study Planner'], ['analytics.html', 'bi-graph-up', 'Analytics'], ['recommendations.html', 'bi-lightbulb', 'Risk & Recommendations'], ['subjects.html', 'bi-book', 'My Subjects'], ['profile.html', 'bi-person-circle', 'Profile']],
    faculty: [['faculty-dashboard.html', 'bi-speedometer2', 'Dashboard'], ['students.html', 'bi-people', 'My Students'], ['subjects.html', 'bi-book', 'My Subjects'], ['academic-records.html', 'bi-journal-check', 'Academic Records'], ['attendance.html', 'bi-calendar-check', 'Attendance'], ['analytics.html', 'bi-graph-up', 'Analytics'], ['recommendations.html', 'bi-shield-check', 'Risk Analysis'], ['profile.html', 'bi-person-circle', 'Profile']],
    admin: [['admin-dashboard.html', 'bi-speedometer2', 'Dashboard'], ['students.html', 'bi-people', 'Students'], ['subjects.html', 'bi-book', 'Subjects'], ['academic-records.html', 'bi-journal-check', 'Academic Records'], ['attendance.html', 'bi-calendar-check', 'Attendance'], ['analytics.html', 'bi-graph-up', 'Analytics'], ['recommendations.html', 'bi-shield-check', 'Risk Analysis'], ['profile.html', 'bi-person-circle', 'Profile']]
  };
  E.init = function (opts) {
    opts = opts || {};
    return E.api('GET', '/api/auth/me').then((r) => {
      E.user = r.user; E.student = r.student; E.csrf = r.token;
      if (opts.roles && !opts.roles.includes(E.user.role)) { location.href = '/dashboard'; return $.Deferred().reject().promise(); }
      const page = location.pathname.split('/').pop();
      const links = NAV[E.user.role].map((n) => `<a class="nav-link ${n[0] === page ? 'active' : ''}" href="/${n[0]}"><i class="bi ${n[1]}"></i>${n[2]}</a>`).join('');
      $('#shell').prepend(`<aside class="sidebar" id="sidebar"><a class="brand" href="/"><i class="bi bi-mortarboard-fill"></i> EDUTrack AI</a><div class="nav-label">${esc(E.user.role)}</div><nav class="nav flex-column">${links}</nav></aside>`);
      $('#content').prepend(`<div class="topbar"><div class="d-flex align-items-center gap-2"><button class="btn btn-light d-lg-none" id="menuBtn" aria-label="Menu"><i class="bi bi-list"></i></button><h1>${esc(opts.title || document.title.split('—')[0])}</h1></div>
        <div class="d-flex align-items-center gap-2"><button class="btn btn-light btn-sm" id="themeBtn" title="Dark mode"><i class="bi bi-moon-stars"></i></button>
        <div class="dropdown"><button class="btn btn-light dropdown-toggle" data-bs-toggle="dropdown"><i class="bi bi-person-circle"></i> ${esc(E.user.name)}</button><ul class="dropdown-menu dropdown-menu-end"><li><a class="dropdown-item" href="/profile.html">Profile</a></li><li><button class="dropdown-item" id="logoutBtn">Log out</button></li></ul></div></div></div>`);
      $('#menuBtn').on('click', () => $('#sidebar').toggleClass('open'));
      $('#logoutBtn').on('click', () => E.post('/api/auth/logout').always(() => { location.href = '/login.html'; }));
      const applyTheme = (t) => { document.documentElement.setAttribute('data-theme', t); document.documentElement.setAttribute('data-bs-theme', t); };
      applyTheme(localStorage.getItem('edu-theme') || 'light');
      $('#themeBtn').on('click', () => { const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; localStorage.setItem('edu-theme', t); applyTheme(t); });
      return E.user;
    }, (xhr) => { if (xhr && xhr.status === 401) location.href = '/login.html'; return $.Deferred().reject(xhr).promise(); });
  };
  E.isStaff = () => E.user && (E.user.role === 'admin' || E.user.role === 'faculty');

  /* ---------- option loaders ---------- */
  E.loadSubjects = (sel, opts) => E.get('/api/subjects', { limit: 200, active: true }).done((r) => {
    const $s = $(sel); $s.find('option:not([value=""])').remove();
    r.data.forEach((s) => $s.append(`<option value="${s._id}">${esc(s.code)} — ${esc(s.name)}</option>`));
    if (opts && opts.value) $s.val(opts.value);
  });

  /* ---------- generic CRUD table + modal form (used by most pages) ---------- */
  E.crud = function (cfg) {
    const $root = $(cfg.el);
    const state = { page: 1, rows: [], editing: null };
    const id = 'crud' + Math.random().toString(36).slice(2, 7);
    const filters = (cfg.filters || []).map((f) => f.type === 'select'
      ? `<div class="col-6 col-md-3 col-lg-2"><select class="form-select form-select-sm" data-f="${f.name}" aria-label="${f.label}"><option value="">${f.label}: All</option>${(f.options || []).map((o) => `<option value="${o.value ?? o}">${esc(o.label ?? o)}</option>`).join('')}</select></div>`
      : f.type === 'date' ? `<div class="col-6 col-md-3 col-lg-2"><input type="date" class="form-control form-control-sm" data-f="${f.name}" title="${f.label}" aria-label="${f.label}"></div>`
        : `<div class="col-12 col-md-4 col-lg-3"><input type="search" class="form-control form-control-sm" data-f="${f.name}" placeholder="${f.label}"></div>`).join('');
    $root.html(`<div class="card"><div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2"><span>${esc(cfg.title)}</span><div class="d-flex gap-2 no-print">${cfg.report ? '<button class="btn btn-sm btn-outline-secondary" data-act="csv"><i class="bi bi-download"></i> CSV</button>' : ''}${cfg.canCreate ? `<button class="btn btn-sm btn-primary" data-act="new"><i class="bi bi-plus-lg"></i> Add</button>` : ''}</div></div>
      <div class="card-body pb-0"><div class="row g-2 mb-2" id="${id}f">${filters}<div class="col-auto"><button class="btn btn-sm btn-light" data-act="clear">Clear</button></div></div><div id="${id}s" class="small text-muted mb-2"></div></div>
      <div class="table-responsive"><table class="table table-hover align-middle mb-0"><thead><tr>${cfg.columns.map((c) => `<th>${c.label}</th>`).join('')}<th class="text-end no-print">Actions</th></tr></thead><tbody id="${id}b"></tbody></table></div>
      <div class="card-footer bg-transparent d-flex justify-content-between align-items-center"><small id="${id}p" class="text-muted"></small><div class="btn-group btn-group-sm"><button class="btn btn-outline-secondary" data-act="prev">Prev</button><button class="btn btn-outline-secondary" data-act="next">Next</button></div></div></div>
      <div class="modal fade" id="${id}m" tabindex="-1"><div class="modal-dialog modal-dialog-centered modal-lg"><form class="modal-content" novalidate><div class="modal-header"><h5 class="modal-title"></h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div class="alert alert-danger d-none"></div><div class="row g-3"></div></div><div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form></div></div>`);
    const $body = $('#' + id + 'b'), modalEl = document.getElementById(id + 'm'), modal = new bootstrap.Modal(modalEl), $form = $(modalEl).find('form');

    function params() {
      const p = { page: state.page, limit: cfg.limit || 10 };
      $root.find('[data-f]').each(function () { const v = $(this).val(); if (v) p[$(this).data('f')] = v; });
      return $.extend(p, cfg.baseParams || {});
    }
    function load() {
      $body.html(`<tr><td colspan="${cfg.columns.length + 1}"><div class="loading"><div class="spinner-border spinner-border-sm"></div> Loading…</div></td></tr>`);
      return E.get(cfg.endpoint, params()).done((r) => {
        state.rows = r.data;
        if (!r.data.length) $body.html(`<tr><td colspan="${cfg.columns.length + 1}"><div class="empty"><i class="bi bi-inbox"></i>${esc(cfg.empty || 'No records found.')}</div></td></tr>`);
        else $body.html(r.data.map((row, i) => `<tr data-i="${i}">${cfg.columns.map((c) => `<td>${c.render ? c.render(row) : esc(row[c.key] ?? '—')}</td>`).join('')}<td class="text-end text-nowrap no-print">${(cfg.rowActions ? cfg.rowActions(row) : '')}${cfg.canEdit && cfg.canEdit(row) ? '<button class="btn btn-sm btn-outline-primary me-1" data-act="edit" title="Edit"><i class="bi bi-pencil"></i></button>' : ''}${cfg.canDelete && cfg.canDelete(row) ? '<button class="btn btn-sm btn-outline-danger" data-act="del" title="Delete"><i class="bi bi-trash"></i></button>' : ''}</td></tr>`).join(''));
        const pg = r.pagination; $('#' + id + 'p').text(`Page ${pg.page} of ${pg.pages} · ${pg.total} record(s)`);
        $root.find('[data-act=prev]').prop('disabled', pg.page <= 1); $root.find('[data-act=next]').prop('disabled', pg.page >= pg.pages);
        $('#' + id + 's').html(cfg.summary ? cfg.summary(r) : '');
        if (cfg.onLoad) cfg.onLoad(r);
      }).fail((x) => $body.html(`<tr><td colspan="${cfg.columns.length + 1}"><div class="alert alert-danger m-3">${esc(E.err(x))}</div></td></tr>`));
    }
    E.reload = load;

    const inputHtml = (f) => {
      const req = f.required ? 'required' : '', ph = f.placeholder ? `placeholder="${f.placeholder}"` : '', n = `name="${f.name}"`, extra = f.attrs || '';
      if (f.type === 'select') return `<select class="form-select" ${n} ${req}><option value="">${f.placeholder || 'Select…'}</option>${(f.options || []).map((o) => `<option value="${o.value ?? o}">${esc(o.label ?? o)}</option>`).join('')}</select>`;
      if (f.type === 'multiselect') return `<select class="form-select" ${n} multiple size="5"></select><div class="form-text">Hold Ctrl (or Cmd) to select several.</div>`;
      if (f.type === 'textarea') return `<textarea class="form-control" rows="2" ${n} ${ph} ${extra}></textarea>`;
      if (f.type === 'checkbox') return `<div class="form-check form-switch"><input class="form-check-input" type="checkbox" ${n}></div>`;
      return `<input class="form-control" type="${f.type || 'text'}" ${n} ${req} ${ph} ${extra}>`;
    };
    function buildForm() {
      const $row = $form.find('.row').empty();
      cfg.fields.forEach((f) => $row.append(`<div class="${f.col || 'col-md-6'}" data-field="${f.name}"><label class="form-label small fw-semibold">${f.label}${f.required ? ' *' : ''}</label>${inputHtml(f)}<div class="invalid-feedback"></div></div>`));
      cfg.fields.forEach((f) => {
        if (f.optionsUrl) E.get(f.optionsUrl, { limit: 200 }).done((r) => {
          const $s = $form.find(`[name=${f.name}]`); $s.find('option:not([value=""])').remove();
          r.data.forEach((o) => $s.append(`<option value="${o._id}">${esc(f.optionLabel(o))}</option>`));
          if (state.pending) $s.val(state.pending[f.name]);
        });
      });
    }
    function openForm(row) {
      state.editing = row || null; state.pending = row ? cfg.toForm(row) : null;
      $form[0].reset(); $form.find('.is-invalid').removeClass('is-invalid'); $form.find('.alert').addClass('d-none');
      $(modalEl).find('.modal-title').text(`${row ? 'Edit' : 'Add'} ${cfg.singular || cfg.title}`);
      cfg.fields.forEach((f) => {
        const $f = $form.find(`[name=${f.name}]`), $wrap = $form.find(`[data-field=${f.name}]`);
        $wrap.toggle(!(row ? f.hideOnEdit : f.hideOnCreate)); $f.prop('required', !!f.required && !(row && f.hideOnEdit));
        const v = row ? state.pending[f.name] : f.default;
        if (f.type === 'checkbox') $f.prop('checked', v !== undefined ? !!v : true); else if (v !== undefined && v !== null) $f.val(v);
      });
      if (cfg.onOpen) cfg.onOpen($form, row);
      modal.show();
    }
    function collect() {
      const o = {};
      cfg.fields.forEach((f) => {
        const $f = $form.find(`[name=${f.name}]`);
        if (!$form.find(`[data-field=${f.name}]`).is(':visible')) return;
        let v = f.type === 'checkbox' ? $f.is(':checked') : $f.val();
        if (f.type === 'number' && v !== '' && v !== null) v = Number(v);
        if (v === '' || v === null) { if (f.sendEmpty) v = null; else return; }
        o[f.name] = v;
      });
      return cfg.toPayload ? cfg.toPayload(o) : o;
    }

    $form.on('submit', function (e) {
      e.preventDefault();
      if (!this.checkValidity()) { $form.find(':invalid').addClass('is-invalid'); $form.find(':invalid').first().trigger('focus'); return; }
      $form.find('.is-invalid').removeClass('is-invalid');
      const $btn = $form.find('[type=submit]').prop('disabled', true).text('Saving…');
      const call = state.editing ? E.put(`${cfg.endpoint}/${state.editing._id}`, collect()) : E.post(cfg.endpoint, collect());
      call.done((r) => { modal.hide(); E.toast(r.message || 'Saved.', 'success'); load(); if (cfg.onSaved) cfg.onSaved(r); })
        .fail((x) => { $form.find('.alert').removeClass('d-none').text(E.err(x)); ((x.responseJSON || {}).errors || []).forEach((er) => $form.find(`[name=${er.field}]`).addClass('is-invalid').closest('[data-field]').find('.invalid-feedback').text(er.message)); })
        .always(() => $btn.prop('disabled', false).text('Save'));
    });
    $root.on('click', '[data-act]', function () {
      const act = $(this).data('act'), row = state.rows[$(this).closest('tr').data('i')];
      if (act === 'new') openForm(); else if (act === 'edit') openForm(row);
      else if (act === 'prev') { state.page--; load(); } else if (act === 'next') { state.page++; load(); }
      else if (act === 'clear') { $root.find('[data-f]').val(''); state.page = 1; load(); }
      else if (act === 'csv') E.downloadCsv(cfg.report, params());
      else if (act === 'del') E.confirm(cfg.deleteMsg ? cfg.deleteMsg(row) : 'Delete this record? This cannot be undone.', 'Delete').then((ok) => {
        if (ok) E.del(`${cfg.endpoint}/${row._id}`).done((r) => { E.toast(r.message || 'Deleted.', r.deactivated ? 'warning' : 'success'); load(); }).fail((x) => E.toast(E.err(x), 'error'));
      });
      else if (cfg.actions && cfg.actions[act]) cfg.actions[act](row, load);
    });
    let tm; $root.on('input change', '[data-f]', function () { clearTimeout(tm); tm = setTimeout(() => { state.page = 1; load(); }, $(this).is('[type=search]') ? 350 : 0); });
    buildForm(); load();
    return { reload: load, open: openForm };
  };

  /* ---------- shared UI builders ---------- */
  E.statCard = (icon, color, value, label, col) => `<div class="${col || 'col-6 col-lg-4 col-xl-2'}"><div class="card stat-card"><div class="stat-icon bg-i-${color}"><i class="bi ${icon}"></i></div><div><div class="v">${value}</div><div class="l">${esc(label)}</div></div></div></div>`;

  // Fills a <select> with students enrolled in a subject (used by marks and attendance forms)
  E.fillStudents = function ($sel, subjectId, selected) {
    $sel.find('option:not([value=""])').remove();
    if (!subjectId) return $.Deferred().resolve().promise();
    return E.get('/api/students', { subject: subjectId, limit: 100, active: true }).done((r) => {
      r.data.forEach((s) => $sel.append(`<option value="${s._id}">${esc(s.studentId)} — ${esc(s.user ? s.user.name : '')}</option>`));
      if (selected) $sel.val(selected);
    });
  };

  // Renders the full risk explanation (ring, factors, evidence, missing data, actions)
  E.riskDetail = function (d, compact) {
    if (d.status !== 'ok') {
      return `<div class="text-center"><div class="risk-ring mx-auto mb-2 risk-na" style="font-size:1rem">N/A</div><h6>Insufficient data</h6><p class="small">${esc(d.explanation)}</p>
        <ul class="small text-start">${(d.missing || []).map((m) => `<li>${esc(m)}</li>`).join('')}</ul></div><p class="small text-muted mb-0">${esc(d.disclaimer || '')}</p>`;
    }
    const cls = d.category === 'Low Risk' ? 'low' : d.category === 'Moderate Risk' ? 'mod' : 'high';
    let h = `<div class="d-flex align-items-center gap-3 mb-3"><div class="risk-ring ${cls}">${d.score}</div><div><div class="mb-1">${E.riskBadge(d)}</div><div class="small text-muted">Data completeness: ${d.dataCompleteness}% · ${esc(d.algorithmVersion)}</div></div></div><p>${esc(d.explanation)}</p>`;
    if (compact) return h + `<p class="small text-muted mb-0">${esc(d.disclaimer)}</p>`;
    h += '<h6>Contributing factors</h6>' + d.factors.map((f) => `<div class="factor"><div class="d-flex justify-content-between"><b>${esc(f.label)}</b><span>${f.points} / ${f.maxPoints} pts</span></div><div class="small text-muted">${esc(f.detail)}</div></div>`).join('');
    const ev = d.evidence || {};
    if (ev.subjectAverages && ev.subjectAverages.length) h += '<h6 class="mt-3">Evidence: subject averages</h6><ul class="small">' + ev.subjectAverages.map((s) => `<li>${esc(s.name)}: ${s.average}% (${s.count} assessment${s.count > 1 ? 's' : ''})</li>`).join('') + '</ul>';
    if (d.missing && d.missing.length) h += '<h6 class="mt-3">Not included (not enough data)</h6><ul class="small text-muted">' + d.missing.map((m) => `<li>${esc(m)}</li>`).join('') + '</ul>';
    if (d.suggestedActions && d.suggestedActions.length) h += '<h6 class="mt-3">Suggested actions</h6><ul class="small">' + d.suggestedActions.map((a) => `<li>${esc(a)}</li>`).join('') + '</ul>';
    return h + `<p class="small text-muted mt-3 mb-0"><i class="bi bi-info-circle"></i> ${esc(d.disclaimer)}</p>`;
  };

  E.today = () => new Date().toISOString().slice(0, 10);
  E.deferredOf = (arr) => $.when.apply($, arr);

  return E;
})(jQuery);
