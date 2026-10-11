$(function () {
  EDU.init({ title: 'Students' }).done(() => {
    if (EDU.user.role === 'student') { location.href = '/dashboard'; return; }
    const admin = EDU.user.role === 'admin';
    EDU.get('/api/subjects', { limit: 200 }).done((sr) => {
      const depts = [...new Set(sr.data.map((s) => s.department))];
      const statusBadge = (r) => EDU.badge(r.active ? 'Active' : 'Inactive', r.active ? 'success' : 'secondary');
      EDU.crud({
        el: '#crud', endpoint: '/api/students', title: admin ? 'Student records' : 'My students', singular: 'Student', empty: 'No students found.', limit: 10,
        columns: [
          { label: 'Student ID', render: (r) => `<b>${EDU.esc(r.studentId)}</b>` },
          { label: 'Name', render: (r) => EDU.esc(r.user ? r.user.name : '—') },
          { label: 'Email', render: (r) => EDU.esc(r.user ? r.user.email : '—') },
          { label: 'Department', key: 'department' }, { label: 'Sem', key: 'semester' }, { label: 'Year', key: 'year' },
          { label: 'Status', render: statusBadge }, { label: 'Created', render: (r) => EDU.fmt.date(r.createdAt) }
        ],
        filters: [
          { name: 'q', type: 'search', label: 'Search name, email or ID' },
          { name: 'department', type: 'select', label: 'Department', options: depts },
          { name: 'semester', type: 'select', label: 'Semester', options: [1, 2, 3, 4, 5, 6, 7, 8] },
          { name: 'year', type: 'select', label: 'Year', options: [1, 2, 3, 4] },
          { name: 'active', type: 'select', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }
        ],
        canCreate: admin, canEdit: () => admin, canDelete: () => admin, report: null,
        rowActions: (r) => `<a class="btn btn-sm btn-outline-success me-1" href="/recommendations.html?student=${r._id}" title="Advisory risk analysis"><i class="bi bi-shield-check"></i></a>`,
        fields: [
          { name: 'name', label: 'Full name', required: true }, { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'password', label: 'Initial password', type: 'password', required: true, hideOnEdit: true, attrs: 'autocomplete="new-password"' },
          { name: 'studentId', label: 'Student ID', required: true }, { name: 'department', label: 'Department', required: true },
          { name: 'semester', label: 'Semester', type: 'number', required: true, attrs: 'min="1" max="12"' },
          { name: 'year', label: 'Year of study', type: 'number', required: true, attrs: 'min="1" max="6"' },
          { name: 'phone', label: 'Phone (optional)' },
          { name: 'subjects', label: 'Assigned subjects', type: 'multiselect', col: 'col-12', optionsUrl: '/api/subjects', optionLabel: (s) => `${s.code} — ${s.name}` },
          { name: 'active', label: 'Account active', type: 'checkbox', hideOnCreate: true }
        ],
        toForm: (r) => ({ name: r.user.name, email: r.user.email, studentId: r.studentId, department: r.department, semester: r.semester, year: r.year, phone: r.phone || '', subjects: (r.subjects || []).map((s) => s._id), active: r.active }),
        deleteMsg: (r) => `Delete ${r.studentId}? Students with academic history are deactivated instead of deleted.`
      });
    });
  });
});
