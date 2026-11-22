// Custom error carrying an HTTP status code. Thrown anywhere, caught by errorHandler.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}
module.exports = ApiError;
