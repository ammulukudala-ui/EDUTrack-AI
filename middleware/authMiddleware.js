const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

// Loads the logged-in user from the session. Rejects if not logged in or deactivated.
const requireAuth = asyncHandler(async (req, res, next) => {
  if (!req.session || !req.session.userId) throw new ApiError(401, 'Please log in to continue.');
  const user = await User.findById(req.session.userId);
  if (!user || !user.active) {
    await new Promise((r) => req.session.destroy(r));
    throw new ApiError(401, 'Your session has ended. Please log in again.');
  }
  req.user = user;
  next();
});
module.exports = { requireAuth };
