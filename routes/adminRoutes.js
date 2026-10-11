const router = require('express').Router();
const { body } = require('express-validator');
const c = require('../controllers/adminController');
const { requireAuth } = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { rules, validate, idParam } = require('../middleware/validationMiddleware');

router.use(requireAuth, allowRoles('admin'));
router.get('/stats', c.stats);
router.get('/users', c.listUsers);
router.get('/faculty', c.facultyList);
router.post('/users', rules.studentCreate.slice(0, 3).concat(body('role').isIn(['faculty', 'admin']).withMessage('Role must be faculty or admin.')), validate, c.createUser);
router.put('/users/:id', idParam(), body('name').optional().trim().isLength({ min: 2, max: 80 }), body('password').optional().isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters.'), validate, c.updateUser);
router.get('/audit', c.audit);
module.exports = router;
