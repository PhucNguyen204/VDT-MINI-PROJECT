import app from './app.js';
import { apiLogger } from './configs/logger.js';

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  apiLogger.info(`🚀 API Server started successfully on port ${PORT}`, {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  apiLogger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  apiLogger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  apiLogger.error('Unhandled Rejection', {
    reason: reason,
    promise: promise
  });
});

process.on('uncaughtException', (error) => {
  apiLogger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});