$(function () {
  EDU.init({ title: 'Subjects' }).done(() => {
    const admin = EDU.user.role === 'admin';
    const fields = [
      { name: 'code', label: 'Subject code', required: true, attrs: 'maxlength="20"' }, { name: 'name', label: 'Subject name', required: true },
      { name: 'department', label: 'Department', required: true }, { name: 'semester', label: 'Semester', type: 'number', required: true, attrs: 'min="1" max="12"' },
      { name: 'credits', label: 'Credits', type: 'number', attrs: 'min="0" max="20" step="0.5"', default: 3 }
    ];
    if (admin) fields.push({ name: 'faculty', label: 'Assigned faculty', type: 'select', optionsUrl: '/api/admin/faculty', optionLabel: (u) => `${u.name} (${u.email})`, sendEmpty: true, placeholder: 'Unassigned' },
      { name: 'active', label: 'Active', type: 'checkbox', hideOnCreate: true });
    EDU.crud({
      el: '#crud', endpoint: '/api/subjects', title: admin ? 'Subjects' : EDU.user.role === 'faculty' ? 'My assigned subjects' : 'My subjects', singular: 'Subject', empty: 'No subjects found.',
      columns: [{ label: 'Code', render: (r) => `<b>${EDU.esc(r.code)}</b>` }, { label: 'Name', key: 'name' }, { label: 'Department', key: 'department' }, { label: 'Sem', key: 'semester' }, { label: 'Credits', key: 'credits' },
        { label: 'Faculty', render: (r) => EDU.esc(r.faculty ? r.faculty.name : 'Unassigned') }, { label: 'Status', render: (r) => EDU.badge(r.active ? 'Active' : 'Inactive', r.active ? 'success' : 'secondary') }],
      filters: [{ name: 'q', type: 'search', label: 'Search code or name' }, { name: 'semester', type: 'select', label: 'Semester', options: [1, 2, 3, 4, 5, 6, 7, 8] }, { name: 'active', type: 'select', label: 'Status', options: [{ value: 'true', label: 'Active' }, { value: 'false', label: 'Inactive' }] }],
      canCreate: admin, canEdit: () => admin, canDelete: () => admin, fields,
      toForm: (r) => ({ code: r.code, name: r.name, department: r.department, semester: r.semester, credits: r.credits, faculty: r.faculty ? r.faculty._id : '', active: r.active }),
      deleteMsg: (r) => `Delete ${r.code}? Subjects in use are deactivated instead of deleted.`
    });
  });
});
