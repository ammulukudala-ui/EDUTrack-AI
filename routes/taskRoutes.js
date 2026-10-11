const router = require('express').Router();
const c = require('../controllers/taskController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth, allowRoles('student'));
router.post('/', rules.task, validate, c.create);
router.get('/', rules.listFilters, validate, c.list);
router.get('/:id', idParam(), validate, c.get);
router.put('/:id', idParam(), rules.task, validate, c.update);
router.delete('/:id', idParam(), validate, c.remove);
module.exports = router;
