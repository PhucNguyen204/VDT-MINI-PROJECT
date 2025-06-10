import express from 'express';
import routes from './routes/index.js';
import { requestLoggerMiddleware, errorLoggerMiddleware } from './middleware/requestLogger.js';
import { apiLogger } from './configs/logger.js';

const app = express();

// Request logging middleware
app.use(requestLoggerMiddleware);

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json());
app.use('/api', routes);

// Error logging middleware
app.use(errorLoggerMiddleware);

// Global error handler
app.use((err, req, res, next) => {
  apiLogger.error(`Global error handler caught: ${err.message}`, {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });
  
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

export default app;