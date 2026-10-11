const ApiError = require('../utils/ApiError');
// Usage: router.get('/x', requireAuth, allowRoles('admin','faculty'), handler)
const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new ApiError(403, 'You do not have permission to do this.'));
  next();
};
module.exports = { allowRoles };
