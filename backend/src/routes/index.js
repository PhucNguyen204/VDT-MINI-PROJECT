import { Router } from 'express';
import { createPipeline } from '../controllers/pipeline.controller.js';
import multiPipelinesRouter from './multiPipelines.js';
import pipelineManagementRouter from './pipeline_management.js';
import monitoringRouter from './monitoring.js';

const router = Router();

// Legacy single pipeline endpoint
router.post('/pipeline', createPipeline);

// New multi-pipeline endpoints  
router.use('/multi-pipelines', multiPipelinesRouter);

// Pipeline management endpoints
router.use('/pipeline-management', pipelineManagementRouter);

// Monitoring endpoints
router.use('/monitoring', monitoringRouter);

export default router;