const router = require('express').Router();
const c = require('../controllers/reportController');
const { requireAuth } = require('../middleware/authMiddleware');
const { rules, validate } = require('../middleware/validationMiddleware');
router.get('/:type', requireAuth, rules.listFilters, validate, c.download);
module.exports = router;
