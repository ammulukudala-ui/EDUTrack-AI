$(function () {
  EDU.init({ title: 'Profile' }).done(() => {
    const u = EDU.user, s = EDU.student;
    const $f = $('#profileForm');
    $f.find('[name=name]').val(u.name); $('#pEmail').val(u.email); $('#pRole').val(u.role);
    if (s) { $('#pSid').val(s.studentId); $('#pDept').val(s.department); $('#pSem').val(s.semester); $('#pYear').val(s.year); $f.find('[name=phone]').val(s.phone || ''); } else $('.stu').hide();

    const note = ($el, ok, msg) => $el.removeClass('d-none alert-success alert-danger').addClass(ok ? 'alert-success' : 'alert-danger').text(msg);
    $f.on('submit', function (e) {
      e.preventDefault();
      const $b = $f.find('button').prop('disabled', true);
      EDU.put('/api/auth/profile', { name: $f.find('[name=name]').val().trim(), phone: $f.find('[name=phone]').val().trim() })
        .done((r) => { note($('#pMsg'), true, r.message); EDU.toast('Profile updated.', 'success'); }).fail((x) => note($('#pMsg'), false, EDU.err(x))).always(() => $b.prop('disabled', false));
    });
    $('#pwForm').on('submit', function (e) {
      e.preventDefault();
      const $w = $(this), v = (n) => $w.find(`[name=${n}]`).val();
      if (v('newPassword') !== v('confirm')) return note($('#wMsg'), false, 'New passwords do not match.');
      const $b = $w.find('button').prop('disabled', true);
      EDU.put('/api/auth/password', { currentPassword: v('currentPassword'), newPassword: v('newPassword') })
        .done((r) => { note($('#wMsg'), true, r.message); $w[0].reset(); }).fail((x) => note($('#wMsg'), false, EDU.err(x))).always(() => $b.prop('disabled', false));
    });
  });
});
