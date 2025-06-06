// monitoring.routes.js
import express from 'express';
import {
  collectPipelineMetrics,
  collectAllPipelineMetrics,
  getPipelineMetrics,
  simpleCollectPipelineMetrics,
  simpleGetPipelineHealth,
  startMonitoringScheduler,
  stopMonitoringScheduler,
  getMonitoringSchedulerStatus,
  updateMonitoringInterval,
  collectAdvancedMetrics,
  getAdvancedMetrics,
  getMetricsDashboard
} from '../controllers/monitoring.controller.js';

const router = express.Router();

/**
 * POST /api/monitoring/collect/:id
 * Thu thập metrics cho một pipeline cụ thể
 */
router.post('/collect/:id', collectPipelineMetrics);

/**
 * POST /api/monitoring/collect-all
 * Thu thập metrics cho tất cả pipeline đang chạy
 */
router.post('/collect-all', collectAllPipelineMetrics);

/**
 * GET /api/monitoring/metrics/:id?timeRange=1 hour&types=health,throughput
 * Lấy metrics lịch sử của một pipeline
 */
router.get('/metrics/:id', getPipelineMetrics);

/**
 * POST /api/monitoring/simple-collect/:id
 * Thu thập metrics đơn giản cho một pipeline
 */
router.post('/simple-collect/:id', simpleCollectPipelineMetrics);

/**
 * GET /api/monitoring/simple-health/:id
 * Kiểm tra health đơn giản của pipeline
 */
router.get('/simple-health/:id', simpleGetPipelineHealth);

// ──── Scheduler Control ────
router.post('/scheduler/start', startMonitoringScheduler);
router.post('/scheduler/stop', stopMonitoringScheduler);
router.get('/scheduler/status', getMonitoringSchedulerStatus);
router.post('/scheduler/interval', updateMonitoringInterval);

// Advanced monitoring endpoints
router.post('/advanced-collect/:id', collectAdvancedMetrics);
router.get('/advanced-metrics/:id', getAdvancedMetrics); 
router.get('/dashboard/:id', getMetricsDashboard);

export default router;