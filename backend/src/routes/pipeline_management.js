// pipeline_management.routes.js
import express from 'express';
import * as pipelineManagementController from '../controllers/pipeline_management.controller.js';

const router = express.Router();

/**
 * GET /api/pipeline-management/test
 * Test endpoint
 */
router.get('/test', pipelineManagementController.testPipelineManagement);

/**
 * POST /api/pipeline-management/stop/:id
 * Stop a specific pipeline
 */
router.post('/stop/:id', pipelineManagementController.stopPipeline);

/**
 * POST /api/pipeline-management/stop-all
 * Stop all active pipelines
 */
router.post('/stop-all', pipelineManagementController.stopAllPipelines);

/**
 * GET /api/pipeline-management/active
 * Get all active pipelines
 */
router.get('/active', pipelineManagementController.getActivePipelines);

/**
 * GET /api/pipeline-management/status/:id
 * Get pipeline status and detailed info
 */
router.get('/status/:id', pipelineManagementController.getPipelineStatus);

export default router;
