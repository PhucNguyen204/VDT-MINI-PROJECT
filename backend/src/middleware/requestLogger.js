// HTTP Request Logging Middleware
// Log tất cả HTTP requests với thông tin chi tiết

import { apiLogger } from '../configs/logger.js';

/**
 * HTTP Request Logger Middleware
 * Logs all incoming HTTP requests with details
 */
export const requestLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming request
  apiLogger.http(`${req.method} ${req.originalUrl}`, {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? req.body : undefined,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    const duration = Date.now() - startTime;
    
    // Log response
    const logLevel = res.statusCode >= 400 ? 'error' : 'info';
    apiLogger[logLevel](`${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });

    originalEnd.apply(this, args);
  };

  next();
};

/**
 * Error Logger Middleware
 * Logs all application errors
 */
export const errorLoggerMiddleware = (err, req, res, next) => {
  apiLogger.error(`Unhandled error in ${req.method} ${req.originalUrl}`, {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    body: req.body,
  });

  next(err);
};
