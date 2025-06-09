// custom_monitor.controller.js
import { customMonitorService } from '../services/custom_monitor.service.js';

/**
 * POST /api/custom-monitoring/collect/:id
 * Thu thập metrics cho một custom pipeline cụ thể
 */
export async function collectCustomPipelineMetrics(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Custom pipeline ID is required'
      });
    }
    
    const result = await customMonitorService.collectCustomPipelineMetrics(id);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Collect custom pipeline metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/custom-monitoring/collect-all
 * Thu thập metrics cho tất cả custom pipeline đang chạy
 */
export async function collectAllCustomPipelineMetrics(req, res) {
  try {
    const result = await customMonitorService.collectAllCustomPipelineMetrics();
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Collect all custom metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/custom-monitoring/metrics/:id
 * Lấy metrics lịch sử của một custom pipeline
 */
export async function getCustomPipelineMetrics(req, res) {
  try {
    const { id } = req.params;
    const { 
      timeRange = '1h',
      category,
      startTime,
      endTime,
      limit = 100
    } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Custom pipeline ID is required'
      });
    }    // Convert category string to array if provided
    const metricTypes = category ? [category] : null;
    
    const result = await customMonitorService.getCustomPipelineMetrics(
      id, 
      timeRange, 
      metricTypes,
      startTime,
      endTime,
      parseInt(limit)
    );
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Get custom pipeline metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/custom-monitoring/dashboard/:id
 * Lấy dữ liệu dashboard cho một custom pipeline
 */
export async function getCustomPipelineDashboard(req, res) {
  try {
    const { id } = req.params;
    const { timeRange = '1h' } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Custom pipeline ID is required'
      });
    }
    
    const result = await customMonitorService.getCustomPipelineDashboard(id, timeRange);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Get custom pipeline dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/custom-monitoring/overview
 * Lấy tổng quan về tất cả custom pipeline
 */
export async function getCustomPipelinesOverview(req, res) {
  try {
    const { timeRange = '1h' } = req.query;
    
    const db = (await import('../configs/db.js')).db;
    const client = await db.connect();
    
    try {
      // Get total count of all pipelines (not just running)
      const totalCountResult = await client.query(
        'SELECT COUNT(*) as total FROM custom_pipelines WHERE deleted = false'
      );
      const totalPipelines = parseInt(totalCountResult.rows[0].total);
      
      // Get all running pipelines for detailed metrics
      const runningPipelinesResult = await client.query(
        'SELECT id FROM custom_pipelines WHERE status = $1 AND deleted = false',
        ['running']
      );
      
      // Get dashboards only for running pipelines
      const allDashboards = [];
      for (const row of runningPipelinesResult.rows) {
        try {
          const dashboard = await customMonitorService.getCustomPipelineDashboard(row.id, timeRange);
          allDashboards.push({
            pipelineId: row.id,
            ...dashboard
          });
        } catch (error) {
          console.error(`Error getting dashboard for custom pipeline ${row.id}:`, error);
        }
      }
      
      // Calculate statistics
      const runningPipelines = runningPipelinesResult.rows.length;
      const healthyPipelines = allDashboards.filter(d => d.healthCheck?.status === 'healthy').length;
      const unhealthyPipelines = runningPipelines - healthyPipelines; // Only count running but unhealthy
      
      const totalThroughput = allDashboards.reduce((sum, d) => sum + (d.currentMetrics?.events_in_rate || 0), 0);
      const totalEventsProcessed = allDashboards.reduce((sum, d) => sum + (d.currentMetrics?.events_in_total || 0), 0);
      const avgCpuUsage = runningPipelines > 0 ? 
        allDashboards.reduce((sum, d) => sum + (d.currentMetrics?.cpu_usage_percent || 0), 0) / runningPipelines : 0;
      const avgMemoryUsage = runningPipelines > 0 ?
        allDashboards.reduce((sum, d) => sum + (d.currentMetrics?.memory_usage_mb || 0), 0) / runningPipelines : 0;
      
      console.log(`[Custom Monitor Overview] Total: ${totalPipelines}, Running: ${runningPipelines}, Healthy: ${healthyPipelines}, Unhealthy: ${unhealthyPipelines}`);
      
      res.json({
        status: 'success',
        overview: {
          totalPipelines,
          healthyPipelines,
          unhealthyPipelines,
          totalThroughput,
          totalEventsProcessed,
          avgCpuUsage: Math.round(avgCpuUsage * 100) / 100,
          avgMemoryUsage: Math.round(avgMemoryUsage * 100) / 100
        },
        pipelines: allDashboards,
        timeRange
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Get custom pipelines overview error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/custom-monitoring/health/:id
 * Kiểm tra health của một custom pipeline
 */
export async function checkCustomPipelineHealth(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Custom pipeline ID is required'
      });
    }    // Get health check from service
    const { CustomVectorMetricsCollector } = await import('../services/custom_monitor.service.js');
    const metricsCollector = new CustomVectorMetricsCollector();
    const healthCheck = await metricsCollector.getHealthStatus(id);
    
    res.json({
      status: 'success',
      healthCheck,
      pipelineId: id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Check custom pipeline health error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      pipelineId: req.params.id,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * DELETE /api/custom-monitoring/metrics/:id
 * Xóa toàn bộ metrics đã thu thập của một custom pipeline
 */
export async function deleteCustomPipelineMetrics(req, res) {
  try {
    const { id } = req.params;
    const { 
      timeRange,
      metricType,
      olderThan
    } = req.query;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Custom pipeline ID is required'
      });
    }

    const result = await customMonitorService.deleteCustomPipelineMetrics(
      id, 
      timeRange,
      metricType,
      olderThan
    );
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Delete custom pipeline metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/custom-monitoring/metrics-categories
 * Lấy danh sách các category metrics có sẵn
 */
export async function getMetricsCategories(req, res) {
  try {
    const categories = [
      'prometheus',
      'graphql', 
      'container_stats',
      'health'
    ];
    
    res.json({
      status: 'success',
      categories,
      description: {
        prometheus: 'Vector Prometheus metrics (events, throughput, errors)',
        graphql: 'Vector GraphQL metrics (detailed component statistics)',
        container_stats: 'Docker container statistics (CPU, Memory, Network, I/O)',
        health: 'Pipeline health status and API connectivity'
      }
    });
    
  } catch (error) {
    console.error('[Custom Monitor Controller] Get metrics categories error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}
