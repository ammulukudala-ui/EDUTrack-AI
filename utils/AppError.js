// An error with an HTTP status code and a safe message for the browser.
class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; this.expose = true; }
}
module.exports = AppError;
