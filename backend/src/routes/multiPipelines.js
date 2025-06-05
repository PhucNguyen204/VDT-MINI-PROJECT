import express from 'express';
import * as multiPipelineController from '../controllers/multipePipeline.controller.js';

const router = express.Router();

/**
 * POST /api/multi-pipelines
 * Create a new pipeline
 * 
 * Body examples:
 * {
 *   "name": "test-logger",
 *   "mode": "docker_logs"
 * }
 * 
 * {
 *   "name": "web-logs", 
 *   "mode": "push_http",
 *   "listen_port": 8089
 * }
 * 
 * {
 *   "name": "app-files",
 *   "mode": "file",
 *   "include": ["/var/log/app/*.log"]
 * }
 */
router.post('/', multiPipelineController.createMultiPipeline);

/**
 * GET /api/multi-pipelines
 * List all pipelines with metadata
 */
router.get('/', multiPipelineController.listMultiPipelines);

/**
 * GET /api/multi-pipelines/:id
 * Get specific pipeline details
 */
router.get('/:id', multiPipelineController.getMultiPipeline);

/**
 * DELETE /api/multi-pipelines/:id
 * Stop and remove a pipeline
 */
router.delete('/:id', multiPipelineController.stopMultiPipeline);

export default router;
