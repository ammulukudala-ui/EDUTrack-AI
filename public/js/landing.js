$(function () {
  $('#yr').text(new Date().getFullYear());
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { $(e.target).addClass('show'); io.unobserve(e.target); } }), { threshold: 0.15 });
  $('.fade-up').each(function (i) { $(this).css('transition-delay', (i % 6) * 70 + 'ms'); io.observe(this); });
  $('a[href^="#"]').on('click', function (e) { const t = $(this.getAttribute('href')); if (t.length) { e.preventDefault(); $('html,body').animate({ scrollTop: t.offset().top - 60 }, 400); $('#nv').collapse && $('#nv').removeClass('show'); } });
});
