const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = Number(error.statusCode || error.status) || 500;
  let message = error.message || 'Internal server error';

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(error.errors)
      .map((item) => item.message)
      .join(', ');
  } else if (error.code === 11000) {
    statusCode = 409;
    message = 'A record with this value already exists.';
  } else if (error.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format.';
  } else if (
    error.name === 'JsonWebTokenError' ||
    error.name === 'TokenExpiredError' ||
    error.name === 'NotBeforeError'
  ) {
    statusCode = 401;
    message = 'Invalid or expired token.';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large.';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body contains invalid JSON.';
  } else if (statusCode >= 500) {
    message = 'Internal server error';
  }

  const payload = {
    success: false,
    message,
    data: null,
  };

  return res.status(statusCode).json(payload);
};

export default errorMiddleware;
