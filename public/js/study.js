$(function () {
  EDU.init({ title: 'Study Tracker' }).done(() => {
    const isStudent = EDU.user.role === 'student';
    EDU.get('/api/subjects', { limit: 200 }).done((sr) => {
      const subjects = sr.data, opts = subjects.map((s) => ({ value: s._id, label: `${s.code} — ${s.name}` }));

      function loadStats() {
        EDU.get('/api/analytics/productivity').done((r) => {
          const st = r.data.study, days = new Set(st.byDay.map((d) => d.date));
          // study streak = consecutive days (ending today or yesterday) with at least one logged session
          let streak = 0, d = new Date(); d.setUTCHours(0, 0, 0, 0);
          if (!days.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
          while (days.has(d.toISOString().slice(0, 10))) { streak++; d.setUTCDate(d.getUTCDate() - 1); }
          $('#studyCards').html(EDU.statCard('bi-calendar-week', 'blue', EDU.fmt.mins(st.last7Minutes), 'Last 7 days', 'col-6 col-lg-3') + EDU.statCard('bi-calendar-month', 'teal', EDU.fmt.mins(st.last30Minutes), 'Last 30 days', 'col-6 col-lg-3') +
            EDU.statCard('bi-hourglass-split', 'violet', EDU.fmt.mins(st.totalMinutes), 'Total recorded', 'col-6 col-lg-3') + EDU.statCard('bi-fire', 'amber', streak + ' day' + (streak === 1 ? '' : 's'), 'Study streak', 'col-6 col-lg-3'));
          const map = {}; st.byDay.forEach((x) => { map[x.date] = x.minutes; });
          const labels = [], vals = [];
          for (let i = 13; i >= 0; i--) { const dd = new Date(); dd.setUTCDate(dd.getUTCDate() - i); const k = dd.toISOString().slice(0, 10); labels.push(k.slice(5)); vals.push(map[k] || 0); }
          EDU.chart('daysChart', { type: 'bar', data: { labels, datasets: [{ label: 'Minutes', data: vals, backgroundColor: '#2563eb', borderRadius: 6 }] } }, st.byDay.length > 0);
          EDU.chart('subjStudyChart', { type: 'doughnut', data: { labels: st.bySubject.map((s) => s.name), datasets: [{ data: st.bySubject.map((s) => s.minutes), backgroundColor: EDU.palette }] } }, st.bySubject.length > 0);
        });
      }

      EDU.crud({
        el: '#crud', endpoint: '/api/study-logs', title: isStudent ? 'My study sessions' : 'Study sessions (read-only)', singular: 'Study Session', empty: 'No study sessions recorded yet.', report: 'study',
        columns: [...(isStudent ? [] : [{ label: 'Student', render: (r) => EDU.esc(r.student && r.student.user ? r.student.user.name : '') }]),
          { label: 'Date', render: (r) => EDU.fmt.date(r.date) }, { label: 'Subject', render: (r) => EDU.esc(r.subject.name) }, { label: 'Topic', key: 'topic' },
          { label: 'Duration', render: (r) => `<b>${EDU.fmt.mins(r.durationMinutes)}</b>` }, { label: 'Done', render: (r) => (r.completed ? '<i class="bi bi-check-circle-fill text-success"></i>' : '<i class="bi bi-circle text-muted"></i>') }],
        filters: [{ name: 'subject', type: 'select', label: 'Subject', options: opts }, { name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }],
        canCreate: isStudent, canEdit: () => isStudent, canDelete: () => isStudent,
        summary: (r) => `Total in this view: <b>${EDU.fmt.mins(r.summary.totalMinutes)}</b> across ${r.summary.count} session(s)`,
        onLoad: loadStats,
        fields: [{ name: 'subject', label: 'Subject', type: 'select', required: true, options: opts }, { name: 'date', label: 'Study date', type: 'date', required: true, default: EDU.today() },
          { name: 'durationMinutes', label: 'Duration (minutes)', type: 'number', required: true, attrs: 'min="1" max="1440" step="1"' }, { name: 'topic', label: 'Topic studied', required: true },
          { name: 'notes', label: 'Notes (optional)', type: 'textarea', col: 'col-12' }, { name: 'completed', label: 'Completed the planned work', type: 'checkbox' }],
        toForm: (r) => ({ subject: r.subject._id, date: EDU.fmt.date(r.date), durationMinutes: r.durationMinutes, topic: r.topic, notes: r.notes || '', completed: r.completed })
      });
    });
  });
});
