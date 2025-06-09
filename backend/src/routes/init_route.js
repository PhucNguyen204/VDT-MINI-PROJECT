import express from 'express';
import * as customPipelineController from '../controllers/init_controller.js';

const router = express.Router();

/**
 * POST /api/custom-pipelines
 * Create a new custom pipeline
 * 
 * Body examples:
 * 
 * Simple HTTP to Parse + Enrich to S3:
 * {
 *   "name": "simple-http-pipeline",
 *   "sources": {
 *     "web_logs": {
 *       "type": "http",
 *       "listen_port": 8090
 *     }
 *   },
 *   "transforms": {
 *     "web_logs": ["parse", "enrich"]
 *   },
 *   "sinks": {
 *     "web_logs": ["s3"]
 *   }
 * }
 * 
 * Multi-source pipeline:
 * {
 *   "name": "multi-source-pipeline",
 *   "sources": {
 *     "app_logs": {
 *       "type": "file",
 *       "include": ["/runtime/logs/app/logs.log"]
 *     },
 *     "metrics": {
 *       "type": "prometheus_scrape",
 *       "endpoints": ["http://app:9090/metrics"],
 *       "scrape_interval_secs": 30
 *     }
 *   },
 *   "transforms": {
 *     "app_logs": ["parse", "enrich", "reduce"],
 *     "metrics": ["enrich"]
 *   },
 *   "sinks": {
 *     "app_logs": ["s3", "console"],
 *     "metrics": ["cloudwatch_metrics"]
 *   }
 * }
 */
router.post('/', customPipelineController.createCustomPipeline);

/**
 * GET /api/custom-pipelines
 * List all custom pipelines with metadata
 */
router.get('/', customPipelineController.listCustomPipelines);

/**
 * GET /api/custom-pipelines/:id
 * Get specific custom pipeline details
 */
router.get('/:id', customPipelineController.getCustomPipeline);

/**
 * DELETE /api/custom-pipelines/:id
 * Stop and remove a custom pipeline
 */
router.delete('/:id', customPipelineController.stopCustomPipeline);

export default router;
