const router = require('express').Router();
const c = require('../controllers/studyController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
const own = allowRoles('student'); // only students write their own study logs
router.post('/', own, rules.study, validate, c.create);
router.get('/', rules.listFilters, validate, c.list); // faculty/admin: read-only, scoped
router.get('/:id', idParam(), validate, c.get);
router.put('/:id', own, idParam(), rules.study, validate, c.update);
router.delete('/:id', own, idParam(), validate, c.remove);
module.exports = router;
