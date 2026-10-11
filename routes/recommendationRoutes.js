const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/recommendationController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth);
router.get('/', c.list);
router.post('/generate', allowRoles('student'), c.generate);
router.put('/:id', allowRoles('student'), idParam(), body('status').isIn(['Active', 'Completed', 'Dismissed']).withMessage('Invalid status.'), validate, c.update);
router.delete('/:id', allowRoles('student'), idParam(), validate, c.remove);
module.exports = router;
