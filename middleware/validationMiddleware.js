const { body, query, param, validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const AcademicRecord = require('../models/AcademicRecord');
const Attendance = require('../models/Attendance');

// Runs after the rule chains: turns validation problems into a clean 422 response.
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array().map((e) => ({ field: e.path, message: e.msg }));
  next(new ApiError(422, errors[0].message, errors));
}

const idParam = (name = 'id') => param(name).isMongoId().withMessage('Invalid ID.');
const optId = (name, loc = body) => loc(name).optional({ values: 'falsy' }).isMongoId().withMessage(`Invalid ${name}.`);
const reqId = (name) => body(name).isMongoId().withMessage(`${name} is required and must be valid.`);

const passwordRule = (field = 'password') => body(field)
  .isLength({ min: 8, max: 72 }).withMessage('Password must be 8-72 characters.')
  .matches(/[a-z]/).withMessage('Password needs a lowercase letter.')
  .matches(/[A-Z]/).withMessage('Password needs an uppercase letter.')
  .matches(/\d/).withMessage('Password needs a number.');

const emailRule = body('email').trim().isEmail().withMessage('Enter a valid email address.').isLength({ max: 120 }).normalizeEmail({ gmail_remove_dots: false });
const nameRule = body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters.');

const rules = {
  register: [
    nameRule, emailRule,
    body('studentId').trim().isLength({ min: 2, max: 30 }).withMessage('Student ID is required.'),
    body('department').trim().notEmpty().withMessage('Department is required.'),
    body('semester').isInt({ min: 1, max: 12 }).withMessage('Semester must be 1-12.'),
    body('year').isInt({ min: 1, max: 6 }).withMessage('Year must be 1-6.'),
    passwordRule(),
    body('confirmPassword').custom((v, { req }) => v === req.body.password).withMessage('Passwords do not match.')
  ],
  login: [body('email').trim().isEmail().withMessage('Enter a valid email.'), body('password').notEmpty().withMessage('Password is required.')],
  profile: [nameRule.optional(), body('phone').optional({ values: 'falsy' }).trim().matches(/^[0-9+\-\s]{6,20}$/).withMessage('Invalid phone number.')],
  password: [body('currentPassword').notEmpty().withMessage('Current password is required.'), passwordRule('newPassword')],

  studentCreate: [
    nameRule, emailRule, passwordRule(),
    body('studentId').trim().isLength({ min: 2, max: 30 }).withMessage('Student ID is required.'),
    body('department').trim().notEmpty().withMessage('Department is required.'),
    body('semester').isInt({ min: 1, max: 12 }).withMessage('Semester must be 1-12.'),
    body('year').isInt({ min: 1, max: 6 }).withMessage('Year must be 1-6.'),
    body('subjects').optional().isArray().withMessage('Subjects must be a list.'),
    body('subjects.*').optional().isMongoId().withMessage('Invalid subject ID.')
  ],
  studentUpdate: [
    idParam(),
    body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters.'),
    body('email').optional().trim().isEmail().withMessage('Enter a valid email address.').normalizeEmail({ gmail_remove_dots: false }),
    body('studentId').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Invalid Student ID.'),
    body('semester').optional().isInt({ min: 1, max: 12 }).withMessage('Semester must be 1-12.'),
    body('year').optional().isInt({ min: 1, max: 6 }).withMessage('Year must be 1-6.'),
    body('subjects').optional().isArray().withMessage('Subjects must be a list.'),
    body('subjects.*').optional().isMongoId().withMessage('Invalid subject ID.')
  ],
  subject: [
    body('code').trim().isLength({ min: 2, max: 20 }).withMessage('Subject code is required.'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Subject name is required.'),
    body('department').trim().notEmpty().withMessage('Department is required.'),
    body('semester').isInt({ min: 1, max: 12 }).withMessage('Semester must be 1-12.'),
    body('credits').optional({ values: 'falsy' }).isFloat({ min: 0, max: 20 }).withMessage('Credits must be 0-20.'),
    optId('faculty')
  ],
  academic: [
    reqId('student'), reqId('subject'),
    body('assessmentName').trim().notEmpty().withMessage('Assessment name is required.'),
    body('assessmentType').isIn(AcademicRecord.TYPES).withMessage('Invalid assessment type.'),
    body('maxMarks').isFloat({ gt: 0 }).withMessage('Maximum marks must be greater than 0.'),
    body('marksObtained').isFloat({ min: 0 }).withMessage('Marks cannot be negative.')
      .custom((v, { req }) => Number(v) <= Number(req.body.maxMarks)).withMessage('Marks obtained cannot exceed maximum marks.'),
    body('date').isISO8601().withMessage('Enter a valid assessment date.')
  ],
  attendance: [
    reqId('student'), reqId('subject'),
    body('status').isIn(Attendance.STATUSES).withMessage('Invalid attendance status.'),
    body('date').isISO8601().withMessage('Enter a valid date.')
  ],
  study: [
    reqId('subject'),
    body('date').isISO8601().withMessage('Enter a valid study date.'),
    body('durationMinutes').isInt({ min: 1, max: 1440 }).withMessage('Duration must be 1-1440 minutes.'),
    body('topic').trim().notEmpty().withMessage('Topic is required.')
  ],
  task: [
    body('title').trim().isLength({ min: 2, max: 120 }).withMessage('Title is required.'),
    body('dueDate').isISO8601().withMessage('Enter a valid due date.'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Invalid priority.'),
    body('status').optional().isIn(['Pending', 'In Progress', 'Completed']).withMessage('Invalid status.'),
    optId('subject')
  ],
  listFilters: [
    query('from').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid "from" date.'),
    query('to').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid "to" date.'),
    query('subject').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid subject filter.'),
    query('student').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid student filter.'),
    query('studentId').optional({ values: 'falsy' }).isMongoId().withMessage('Invalid student filter.')
  ]
};
module.exports = { validate, rules, idParam };
