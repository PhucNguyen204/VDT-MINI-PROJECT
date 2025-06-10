// Winston Logger Configuration
// Structured logging với multiple transports và levels

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(colors);

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Custom format for file logs (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Create transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: logFormat,
  }),

  // Daily rotate file for all logs
  new DailyRotateFile({
    filename: path.join('d:', 'demo_VDT', 'runtime', 'logs', 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: fileFormat,
  }),

  // Daily rotate file for error logs only
  new DailyRotateFile({
    filename: path.join('d:', 'demo_VDT', 'runtime', 'logs', 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: fileFormat,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  transports,
});

// Create specific loggers for different modules
export const createModuleLogger = (module) => {
  return {
    error: (message, meta = {}) => logger.error(`[${module}] ${message}`, meta),
    warn: (message, meta = {}) => logger.warn(`[${module}] ${message}`, meta),
    info: (message, meta = {}) => logger.info(`[${module}] ${message}`, meta),
    http: (message, meta = {}) => logger.http(`[${module}] ${message}`, meta),
    debug: (message, meta = {}) => logger.debug(`[${module}] ${message}`, meta),
  };
};

// Database operation logger
export const dbLogger = createModuleLogger('DATABASE');

// Repository operation logger
export const repoLogger = createModuleLogger('REPOSITORY');

// Service operation logger  
export const serviceLogger = createModuleLogger('SERVICE');

// Controller operation logger
export const controllerLogger = createModuleLogger('CONTROLLER');

// API request logger
export const apiLogger = createModuleLogger('API');

// Pipeline operation logger
export const pipelineLogger = createModuleLogger('PIPELINE');

// Docker operation logger
export const dockerLogger = createModuleLogger('DOCKER');

export default logger;
