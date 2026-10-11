const crypto = require('crypto');
const ApiError = require('../utils/ApiError');

// Synchronizer-token CSRF protection: token lives in the session; browser sends it in a header.
function csrfProtection(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.get('x-csrf-token') || '';
  const real = req.session.csrf;
  const ok = sent.length === real.length && crypto.timingSafeEqual(Buffer.from(sent), Buffer.from(real));
  if (!ok) return next(new ApiError(403, 'Security token missing or invalid. Please refresh the page and try again.'));
  next();
}
module.exports = { csrfProtection };
