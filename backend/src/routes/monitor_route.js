// custom_monitor.routes.js
import express from 'express';
import {
  collectCustomPipelineMetrics,
  collectAllCustomPipelineMetrics,
  getCustomPipelineMetrics,
  getCustomPipelineDashboard,
  getCustomPipelinesOverview,
  checkCustomPipelineHealth,
  getMetricsCategories,
  deleteCustomPipelineMetrics
} from '../controllers/monitor_controller.js';

const router = express.Router();

/**
 * POST /api/custom-monitoring/collect/:id
 * Thu thập metrics cho một custom pipeline cụ thể
 */
router.post('/collect/:id', collectCustomPipelineMetrics);

/**
 * POST /api/custom-monitoring/collect-all
 * Thu thập metrics cho tất cả custom pipeline đang chạy
 */
router.post('/collect-all', collectAllCustomPipelineMetrics);

/**
 * GET /api/custom-monitoring/metrics/:id?timeRange=1h&category=prometheus&startTime=&endTime=&limit=100
 * Lấy metrics lịch sử của một custom pipeline
 */
router.get('/metrics/:id', getCustomPipelineMetrics);

/**
 * DELETE /api/custom-monitoring/metrics/:id
 * Xóa toàn bộ metrics đã thu thập của một custom pipeline khỏi database
 */
router.delete('/metrics/:id', deleteCustomPipelineMetrics);

/**
 * GET /api/custom-monitoring/dashboard/:id?timeRange=1h
 * Lấy dữ liệu dashboard cho một custom pipeline
 */
router.get('/dashboard/:id', getCustomPipelineDashboard);

/**
 * GET /api/custom-monitoring/overview?timeRange=1h
 * Lấy tổng quan về tất cả custom pipeline
 */
router.get('/overview', getCustomPipelinesOverview);

/**
 * GET /api/custom-monitoring/health/:id
 * Kiểm tra health của một custom pipeline
 */
router.get('/health/:id', checkCustomPipelineHealth);

/**
 * GET /api/custom-monitoring/metrics-categories
 * Lấy danh sách các category metrics có sẵn
 */
router.get('/metrics-categories', getMetricsCategories);

export default router;
