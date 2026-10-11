const router = require('express').Router();
const c = require('../controllers/studentController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
router.post('/', allowRoles('admin'), rules.studentCreate, validate, c.create);
router.get('/', rules.listFilters, validate, c.list);
router.get('/:id', idParam(), validate, c.get);
router.put('/:id', allowRoles('admin'), rules.studentUpdate, validate, c.update);
router.delete('/:id', allowRoles('admin'), idParam(), validate, c.remove);
module.exports = router;
