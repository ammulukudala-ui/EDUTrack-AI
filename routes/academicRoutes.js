const router = require('express').Router();
const c = require('../controllers/academicController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
const staff = allowRoles('admin', 'faculty'); // students can only READ their own marks
router.post('/', staff, rules.academic, validate, c.create);
router.get('/', rules.listFilters, validate, c.list);
router.get('/:id', idParam(), validate, c.get);
router.put('/:id', staff, idParam(), rules.academic, validate, c.update);
router.delete('/:id', staff, idParam(), validate, c.remove);
module.exports = router;
