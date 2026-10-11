const router = require('express').Router();
const c = require('../controllers/riskController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
router.get('/my-assessment', allowRoles('student'), c.mine);
router.get('/students/:studentId', idParam('studentId'), validate, c.forStudent);
router.get('/history/:studentId', idParam('studentId'), validate, c.history);
module.exports = router;
