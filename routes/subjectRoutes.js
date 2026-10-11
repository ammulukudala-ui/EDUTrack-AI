const router = require('express').Router();
const c = require('../controllers/subjectController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
router.post('/', allowRoles('admin'), rules.subject, validate, c.create);
router.get('/', c.list);
router.get('/:id', idParam(), validate, c.get);
router.put('/:id', allowRoles('admin'), idParam(), rules.subject, validate, c.update);
router.delete('/:id', allowRoles('admin'), idParam(), validate, c.remove);
module.exports = router;
