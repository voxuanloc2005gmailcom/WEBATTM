export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'Resource not found'
  });
}

export function errorHandler(error, req, res, _next) {
  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const code = error.code && /^[A-Z0-9_]+$/.test(error.code) ? error.code : 'SERVER_ERROR';

  if (statusCode >= 500) {
    console.error('Unhandled request error', {
      method: req.method,
      path: req.originalUrl,
      error: error.message,
      stack: error.stack
    });
  }

  if (error.retryAfterSeconds) res.setHeader('Retry-After', String(error.retryAfterSeconds));

  res.status(statusCode).json({
    success: false,
    code,
    message: statusCode >= 500 ? 'Internal server error' : error.message
  });
}
