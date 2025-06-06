// monitoring.controller.js
import { monitoringService } from '../services/monitoring.service.js';
import { monitoringScheduler } from '../services/monitoring.scheduler.js';

/**
 * POST /api/monitoring/collect/:id
 * Thu thập metrics cho một pipeline cụ thể
 */
export async function collectPipelineMetrics(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await monitoringService.collectPipelineMetrics(id);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Collect pipeline metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/monitoring/collect-all
 * Thu thập metrics cho tất cả pipeline đang chạy
 */
export async function collectAllPipelineMetrics(req, res) {
  try {
    const result = await monitoringService.collectAllPipelineMetrics();
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Collect all metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/metrics/:id?timeRange=1 hour&types=health,throughput
 * Lấy metrics lịch sử của một pipeline
 */
export async function getPipelineMetrics(req, res) {
  try {
    const { id } = req.params;
    const { timeRange = '1 hour', types } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const metricTypes = types ? types.split(',') : null;
    const result = await monitoringService.getPipelineMetrics(id, timeRange, metricTypes);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Get pipeline metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/dashboard/:id
 * Lấy thông tin dashboard cho pipeline
 */
export async function getMetricsDashboard(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await monitoringService.getMetricsDashboard(id);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Get dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

// ──── Scheduler Control ────

/**
 * POST /api/monitoring/scheduler/start
 * Bắt đầu tự động thu thập metrics
 */
export async function startMonitoringScheduler(req, res) {
  try {
    const { intervalSeconds } = req.body || {};
    
    if (intervalSeconds && !isNaN(intervalSeconds)) {
      monitoringScheduler.setInterval(parseInt(intervalSeconds));
    }
    
    monitoringScheduler.start();
    
    res.json({
      status: 'success',
      message: 'Monitoring scheduler started',
      scheduler: monitoringScheduler.getStatus()
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Start scheduler error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/monitoring/scheduler/stop
 * Dừng tự động thu thập metrics
 */
export async function stopMonitoringScheduler(req, res) {
  try {
    monitoringScheduler.stop();
    
    res.json({
      status: 'success',
      message: 'Monitoring scheduler stopped',
      scheduler: monitoringScheduler.getStatus()
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Stop scheduler error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/scheduler/status
 * Lấy trạng thái của scheduler
 */
export async function getMonitoringSchedulerStatus(req, res) {
  try {
    const status = monitoringScheduler.getStatus();
    
    res.json({
      status: 'success',
      scheduler: status
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Get scheduler status error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/monitoring/scheduler/interval
 * Cập nhật khoảng thời gian thu thập metrics
 */
export async function updateMonitoringInterval(req, res) {
  try {
    const { intervalSeconds } = req.body;
    
    if (!intervalSeconds || isNaN(intervalSeconds)) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid intervalSeconds is required'
      });
    }
    
    monitoringScheduler.setInterval(parseInt(intervalSeconds));
    
    res.json({
      status: 'success',
      message: `Interval updated to ${intervalSeconds} seconds`,
      scheduler: monitoringScheduler.getStatus()
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Update interval error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}