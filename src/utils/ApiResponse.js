class ApiResponse {
  constructor(statusCode, data, message = 'success', errors = null) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
    this.errors = errors;
    this.timestamp = new Date().toISOString(); // ISO timestamp for tracking
  }
}
export { ApiResponse };
