// Test logger functionality

import logger, { 
  dbLogger, 
  repoLogger, 
  serviceLogger, 
  controllerLogger, 
  pipelineLogger,
  dockerLogger 
} from '../src/configs/logger.js';

console.log('Testing Winston Logger Setup...\n');

// Test basic logger
logger.info('Basic logger test');
logger.warn('This is a warning');
logger.error('This is an error');

// Test module loggers
dbLogger.info('Database connection established');
repoLogger.info('Repository operation completed');
serviceLogger.info('Service method executed');
controllerLogger.info('API endpoint called');
pipelineLogger.info('Pipeline operation started');
dockerLogger.info('Docker container started');

// Test with metadata
pipelineLogger.info('Pipeline created successfully', {
  pipelineId: 'test-123',
  name: 'test-pipeline',
  status: 'running'
});

console.log('\nLogger test completed. Check runtime/logs/ for log files.');
