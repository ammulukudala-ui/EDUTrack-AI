const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers/authController');
const { rules, validate } = require('../middleware/validationMiddleware');
const { requireAuth } = require('../middleware/authMiddleware');

// Brute-force protection: 10 attempts / 15 minutes per IP (skipped in tests)
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test', message: { success: false, message: 'Too many login attempts. Please try again in 15 minutes.' } });

router.get('/csrf', c.csrf);
router.post('/register', loginLimiter, rules.register, validate, c.register);
router.post('/login', loginLimiter, rules.login, validate, c.login);
router.post('/logout', c.logout);
router.get('/me', requireAuth, c.me);
router.put('/profile', requireAuth, rules.profile, validate, c.updateProfile);
router.put('/password', requireAuth, rules.password, validate, c.changePassword);
module.exports = router;
