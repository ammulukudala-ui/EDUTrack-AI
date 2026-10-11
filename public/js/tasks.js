$(function () {
  EDU.init({ title: 'Study Planner', roles: ['student'] }).done(() => {
    EDU.get('/api/subjects', { limit: 200 }).done((sr) => {
      const opts = sr.data.map((s) => ({ value: s._id, label: `${s.code} — ${s.name}` }));
      const isOverdue = (t) => t.status !== 'Completed' && new Date(t.dueDate) < new Date();
      const prKind = { High: 'danger', Medium: 'warning', Low: 'secondary' }, stKind = { Pending: 'secondary', 'In Progress': 'primary', Completed: 'success' };

      function stats() {
        EDU.get('/api/analytics/productivity').done((r) => {
          const t = r.data.tasks, pct = t.completionRate || 0;
          $('#taskProgress').html(t.total ? `<div class="d-flex justify-content-between"><span>Completion</span><b>${pct}%</b></div><div class="progress mb-3" style="height:10px"><div class="progress-bar bg-success" style="width:${pct}%"></div></div>
            <div class="small">Completed: <b>${t.Completed}</b> · In progress: <b>${t['In Progress']}</b> · Pending: <b>${t.Pending}</b></div><div class="small overdue mt-1">Overdue: ${t.overdue}</div>` : '<div class="empty"><i class="bi bi-list-check"></i>No tasks yet. Add your first one!</div>');
        });
      }

      /* ----- month calendar ----- */
      let cur = new Date(); cur.setUTCDate(1); cur.setUTCHours(0, 0, 0, 0);
      function drawCal() {
        const y = cur.getUTCFullYear(), m = cur.getUTCMonth(), from = new Date(Date.UTC(y, m, 1)), to = new Date(Date.UTC(y, m + 1, 0));
        $('#calTitle').text(from.toLocaleString('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }));
        EDU.get('/api/tasks', { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10), limit: 100 }).done((r) => {
          const by = {}; r.data.forEach((t) => { const k = EDU.fmt.date(t.dueDate); (by[k] = by[k] || []).push(t); });
          let h = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => `<div class="h">${d}</div>`).join('');
          for (let i = 0; i < from.getUTCDay(); i++) h += '<div style="border:0"></div>';
          for (let d = 1; d <= to.getUTCDate(); d++) {
            const k = new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
            h += `<div class="${k === EDU.today() ? 'today' : ''}">${d}${(by[k] || []).map((t) => `<span class="dot ${t.status === 'Completed' ? 'done' : ''}" title="${EDU.esc(t.title)}">${EDU.esc(t.title)}</span>`).join('')}</div>`;
          }
          $('#cal').html(h);
        });
      }
      $('#calPrev').on('click', () => { cur.setUTCMonth(cur.getUTCMonth() - 1); drawCal(); });
      $('#calNext').on('click', () => { cur.setUTCMonth(cur.getUTCMonth() + 1); drawCal(); });

      EDU.crud({
        el: '#crud', endpoint: '/api/tasks', title: 'My study tasks', singular: 'Task', empty: 'No tasks match these filters.', canCreate: true, canEdit: () => true, canDelete: () => true,
        columns: [
          { label: 'Task', render: (t) => `<b class="${t.status === 'Completed' ? 'text-decoration-line-through text-muted' : ''}">${EDU.esc(t.title)}</b>${t.description ? `<br><small class="text-muted">${EDU.esc(t.description)}</small>` : ''}` },
          { label: 'Subject', render: (t) => EDU.esc(t.subject ? t.subject.name : '—') }, { label: 'Priority', render: (t) => EDU.badge(t.priority, prKind[t.priority]) },
          { label: 'Due', render: (t) => `<span class="${isOverdue(t) ? 'overdue' : ''}">${EDU.fmt.date(t.dueDate)}${isOverdue(t) ? ' · OVERDUE' : ''}</span>` }, { label: 'Status', render: (t) => EDU.badge(t.status, stKind[t.status]) }],
        filters: [{ name: 'subject', type: 'select', label: 'Subject', options: opts }, { name: 'priority', type: 'select', label: 'Priority', options: ['Low', 'Medium', 'High'] },
          { name: 'status', type: 'select', label: 'Status', options: [{ value: 'open', label: 'Open (not completed)' }, 'Pending', 'In Progress', 'Completed'] }, { name: 'overdue', type: 'select', label: 'Deadline', options: [{ value: 'true', label: 'Overdue only' }] }],
        rowActions: (t) => (t.status !== 'Completed' ? '<button class="btn btn-sm btn-outline-success me-1" data-act="done" title="Mark completed"><i class="bi bi-check2"></i></button>' : ''),
        actions: { done: (t, reload) => EDU.put(`/api/tasks/${t._id}`, { title: t.title, dueDate: t.dueDate, status: 'Completed' }).done(() => { EDU.toast('Task marked completed.', 'success'); reload(); }).fail((x) => EDU.toast(EDU.err(x), 'error')) },
        onLoad: () => { stats(); drawCal(); },
        fields: [{ name: 'title', label: 'Task title', required: true, col: 'col-12' }, { name: 'description', label: 'Description', type: 'textarea', col: 'col-12' },
          { name: 'subject', label: 'Subject', type: 'select', options: opts, sendEmpty: true, placeholder: 'No subject' }, { name: 'dueDate', label: 'Due date', type: 'date', required: true, default: EDU.today() },
          { name: 'priority', label: 'Priority', type: 'select', options: ['Low', 'Medium', 'High'], default: 'Medium' }, { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'In Progress', 'Completed'], default: 'Pending' }],
        toForm: (t) => ({ title: t.title, description: t.description || '', subject: t.subject ? t.subject._id : '', dueDate: EDU.fmt.date(t.dueDate), priority: t.priority, status: t.status })
      });
    });
  });
});
