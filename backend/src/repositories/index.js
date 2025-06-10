// Repository Index File
// Exports all repositories for easy importing

import { db } from '../configs/db.js';
import { CustomPipelineRepository } from './CustomPipelineRepository.js';
import { PipelineLogsRepository } from './PipelineLogsRepository.js';

// Create repository instances
export const pipelineRepository = new CustomPipelineRepository(db);
export const logsRepository = new PipelineLogsRepository(db);

// Export classes for testing or custom instances
export { CustomPipelineRepository, PipelineLogsRepository };
export { BaseRepository } from './BaseRepository.js';
