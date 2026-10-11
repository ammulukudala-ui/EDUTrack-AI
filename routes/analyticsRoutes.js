const router = require('express').Router();
const c = require('../controllers/analyticsController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate } = require('../middleware/validationMiddleware');

router.use(requireAuth, rules.listFilters, validate);
router.get('/dashboard', c.dashboard);
router.get('/performance', c.performance);
router.get('/attendance', c.attendance);
router.get('/productivity', c.productivity);
router.get('/cohort', allowRoles('faculty', 'admin'), c.cohort);
module.exports = router;
