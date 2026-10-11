const router = require('express').Router();
const c = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
const staff = allowRoles('admin', 'faculty');
router.post('/', staff, rules.attendance, validate, c.create);
router.get('/', rules.listFilters, validate, c.list);
router.get('/:id', idParam(), validate, c.get);
router.put('/:id', staff, idParam(), rules.attendance, validate, c.update);
router.delete('/:id', staff, idParam(), validate, c.remove);
module.exports = router;
