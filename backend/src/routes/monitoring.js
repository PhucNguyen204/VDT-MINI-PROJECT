// monitoring.routes.js
import express from 'express';
import {
  collectPipelineMetrics,
  collectAllPipelineMetrics,
  getPipelineMetrics,
  startMonitoringScheduler,
  stopMonitoringScheduler,
  getMonitoringSchedulerStatus,
  updateMonitoringInterval,
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

// ──── Scheduler Control ────
router.post('/scheduler/start', startMonitoringScheduler);
router.post('/scheduler/stop', stopMonitoringScheduler);
router.get('/scheduler/status', getMonitoringSchedulerStatus);
router.post('/scheduler/interval', updateMonitoringInterval);

// Dashboard endpoint
router.get('/dashboard/:id', getMetricsDashboard);

export default router;