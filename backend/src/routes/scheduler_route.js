// Scheduler Routes for Custom Pipeline Metrics Collection
import express from 'express';
import { schedulerController } from '../controllers/scheduler_controller.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SchedulerStatus:
 *       type: object
 *       properties:
 *         is_running:
 *           type: boolean
 *           description: Whether the scheduler is currently running
 *         interval_seconds:
 *           type: integer
 *           description: Collection interval in seconds
 *         last_collection:
 *           type: string
 *           format: date-time
 *           description: Last collection timestamp
 *         next_collection:
 *           type: string
 *           format: date-time
 *           description: Next scheduled collection time
 *         stats:
 *           type: object
 *           properties:
 *             totalRuns:
 *               type: integer
 *             successfulRuns:
 *               type: integer
 *             failedRuns:
 *               type: integer
 *             lastError:
 *               type: string
 *               nullable: true
 */

/**
 * @swagger
 * /api/scheduler/start:
 *   post:
 *     summary: Start automatic metrics collection
 *     tags: [Scheduler]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               interval_seconds:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 86400
 *                 default: 30
 *                 description: Collection interval in seconds (10s - 24h)
 *           examples:
 *             default:
 *               summary: Default 30 second interval
 *               value:
 *                 interval_seconds: 30
 *             high_frequency:
 *               summary: High frequency monitoring
 *               value:
 *                 interval_seconds: 10
 *             standard:
 *               summary: Standard monitoring
 *               value:
 *                 interval_seconds: 60
 *     responses:
 *       200:
 *         description: Scheduler started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [running]
 *                     interval_seconds:
 *                       type: integer
 *                     started_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request or scheduler already running
 */
router.post('/start', schedulerController.startScheduler);

/**
 * @swagger
 * /api/scheduler/stop:
 *   post:
 *     summary: Stop automatic metrics collection
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Scheduler stopped successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [stopped]
 *                     stats:
 *                       type: object
 *                     stopped_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Scheduler is not running
 */
router.post('/stop', schedulerController.stopScheduler);

/**
 * @swagger
 * /api/scheduler/interval:
 *   put:
 *     summary: Update scheduler interval
 *     tags: [Scheduler]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - interval_seconds
 *             properties:
 *               interval_seconds:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 86400
 *                 description: New collection interval in seconds
 *           examples:
 *             fast:
 *               summary: Fast monitoring (30s)
 *               value:
 *                 interval_seconds: 30
 *             standard:
 *               summary: Standard monitoring (1 min)
 *               value:
 *                 interval_seconds: 60
 *             slow:
 *               summary: Slow monitoring (5 min)
 *               value:
 *                 interval_seconds: 300
 *     responses:
 *       200:
 *         description: Interval updated successfully
 *       400:
 *         description: Invalid interval value
 */
router.put('/interval', schedulerController.updateInterval);

/**
 * @swagger
 * /api/scheduler/status:
 *   get:
 *     summary: Get scheduler status and statistics
 *     tags: [Scheduler]
 *     responses:
 *       200:
 *         description: Scheduler status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     scheduler:
 *                       $ref: '#/components/schemas/SchedulerStatus'
 *                     server_time:
 *                       type: string
 *                       format: date-time
 */
router.get('/status', schedulerController.getStatus);

/**
 * @swagger
 * /api/scheduler/trigger:
 *   post:
 *     summary: Trigger manual metrics collection
 *     tags: [Scheduler]
 *     description: Manually trigger a one-time metrics collection for all running pipelines
 *     responses:
 *       200:
 *         description: Manual collection triggered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     triggered_manually:
 *                       type: boolean
 *                     pipelines_count:
 *                       type: integer
 *                     metrics_collected:
 *                       type: integer
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           pipeline_id:
 *                             type: integer
 *                           pipeline_name:
 *                             type: string
 *                           success:
 *                             type: boolean
 *                           metrics_collected:
 *                             type: integer
 *                     collection_time:
 *                       type: string
 *                       format: date-time
 *                     duration_ms:
 *                       type: integer
 *       500:
 *         description: Error during manual collection
 */
router.post('/trigger', schedulerController.triggerCollection);

/**
 * @swagger
 * /api/scheduler/reset-stats:
 *   post:
 *     summary: Reset scheduler statistics
 *     tags: [Scheduler]
 *     description: Reset all scheduler statistics (run counts, errors)
 *     responses:
 *       200:
 *         description: Statistics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     reset_at:
 *                       type: string
 *                       format: date-time
 */
router.post('/reset-stats', schedulerController.resetStats);

/**
 * @swagger
 * /api/scheduler/config:
 *   get:
 *     summary: Get scheduler configuration and recommendations
 *     tags: [Scheduler]
 *     description: Get current configuration, recommended intervals, and usage statistics
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     current_config:
 *                       type: object
 *                     recommendations:
 *                       type: object
 *                       properties:
 *                         minimum_interval:
 *                           type: integer
 *                         maximum_interval:
 *                           type: integer
 *                         recommended_intervals:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               seconds:
 *                                 type: integer
 *                               description:
 *                                 type: string
 *                     stats:
 *                       type: object
 */
router.get('/config', schedulerController.getConfig);

export default router;
