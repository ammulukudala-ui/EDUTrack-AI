/* Login + registration with jQuery AJAX */
$(function () {
  const $msg = $('#msg');
  const show = (t) => $msg.removeClass('d-none').text(t);
  if (/expired=1/.test(location.search)) { $msg.removeClass('d-none alert-danger').addClass('alert-warning').text('Your session expired. Please log in again.'); }

  // If already logged in, jump to dashboard
  EDU.api('GET', '/api/auth/me').done(() => { location.href = '/dashboard'; });

  function handle($form, url, buildData) {
    $form.on('submit', function (e) {
      e.preventDefault();
      $msg.addClass('d-none');
      $form.find('.is-invalid').removeClass('is-invalid');
      if (!this.checkValidity()) { $form.find(':invalid').addClass('is-invalid'); show('Please fill in all required fields correctly.'); return; }
      const data = buildData();
      if (data.confirmPassword !== undefined && data.password !== data.confirmPassword) { $form.find('[name=confirmPassword]').addClass('is-invalid'); show('Passwords do not match.'); return; }
      const $btn = $form.find('[type=submit]').prop('disabled', true); const old = $btn.text(); $btn.text('Please wait…');
      EDU.post(url, data).done(() => { location.href = '/dashboard'; })
        .fail((xhr) => { show(EDU.err(xhr)); ((xhr.responseJSON || {}).errors || []).forEach((er) => $form.find(`[name=${er.field}]`).addClass('is-invalid')); })
        .always(() => $btn.prop('disabled', false).text(old));
    });
  }
  handle($('#loginForm'), '/api/auth/login', () => ({ email: $('[name=email]').val().trim(), password: $('[name=password]').val() }));
  handle($('#regForm'), '/api/auth/register', () => {
    const o = {}; $('#regForm').serializeArray().forEach((f) => { o[f.name] = f.value.trim ? (f.name.includes('assword') ? f.value : f.value.trim()) : f.value; });
    o.semester = Number(o.semester); o.year = Number(o.year); return o;
  });
});
