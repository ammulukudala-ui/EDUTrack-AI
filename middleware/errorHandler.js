const ApiError = require('../utils/ApiError');

const notFound = (req, res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));

// Central error handler: never leaks stack traces or secrets.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  let status = err.status || 500;
  let message = err.message;
  let details = err.details;

  if (err.name === 'ValidationError' && err.errors) {            // Mongoose validation
    status = 422; message = 'Validation failed.';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {                          // bad ObjectId etc.
    status = 400; message = `Invalid value for ${err.path}.`;
  } else if (err.code === 11000) {                                // duplicate key
    status = 409;
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'value';
    message = field === 'email' ? 'This email is already registered.'
      : field === 'studentId' ? 'This Student ID already exists.'
      : field === 'code' ? 'This subject code already exists.'
      : (err.keyPattern && err.keyPattern.date) ? 'Attendance for this student, subject and date already exists.'
      : `Duplicate ${field}.`;
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Invalid JSON in request.';
  } else if (!err.isApiError) {
    status = 500; message = 'Something went wrong on the server. Please try again.';
    console.error('Unexpected error:', err);
  }
  if (status >= 500 && process.env.NODE_ENV === 'production') details = undefined;
  res.status(status).json({ success: false, message, ...(details ? { errors: details } : {}) });
}
module.exports = { notFound, errorHandler };
