// monitoring.controller.js
import { monitoringService } from '../services/monitoring.service.js';
import { simpleMonitoringService } from '../services/monitoring.service.simple.js';
import { monitoringScheduler } from '../services/monitoring.scheduler.js';
import { AdvancedMonitoringService } from '../services/monitoring.service.advanced.js';

const advancedMonitoring = new AdvancedMonitoringService();

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
 * GET /api/monitoring/metrics/:id
 * Lấy metrics gần đây của một pipeline
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
 * GET /api/monitoring/overview
 * Lấy tổng quan metrics của tất cả pipeline
 */
export async function getAllPipelinesOverview(req, res) {
  try {
    const result = await monitoringService.getAllPipelinesOverview();
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Get overview error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/health/:id
 * Kiểm tra health status của một pipeline
 */
export async function getPipelineHealth(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    // Lấy metrics health gần đây nhất
    const result = await monitoringService.getPipelineMetrics(id, '15 minutes', ['health']);
    
    if (result.metrics.length === 0) {
      return res.json({
        status: 'warning',
        pipeline_id: id,
        health_status: 'unknown',
        message: 'No recent health metrics available'
      });
    }
    
    const latestHealth = result.metrics[0];
    const healthStatus = latestHealth.metric_value === 1 ? 'healthy' : 'unhealthy';
    
    res.json({
      status: 'success',
      pipeline_id: id,
      health_status: healthStatus,
      last_check: latestHealth.collected_at,
      ...result
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Get pipeline health error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/alerts
 * Lấy danh sách alerts đang active
 */
export async function getActiveAlerts(req, res) {
  try {
    // TODO: Implement alert checking logic
    res.json({
      status: 'success',
      message: 'Alert system not implemented yet',
      alerts: []
    });
    
  } catch (error) {
    console.error('[Monitoring Controller] Get alerts error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/test
 * Test endpoint để verify monitoring system
 */
export async function testMonitoring(req, res) {
  try {
    res.json({
      status: 'success',
      message: 'Monitoring API is working',
      timestamp: new Date().toISOString(),
      features: {
        vector_api: 'GraphQL API integration for metrics collection',
        metrics_storage: 'PostgreSQL for historical data',
        real_time: 'Collect throughput, errors, buffer, health metrics',
        alerting: 'Threshold-based alerts (coming soon)'
      },
      endpoints: {
        collect: 'POST /api/monitoring/collect/:id - Collect metrics for specific pipeline',
        collectAll: 'POST /api/monitoring/collect-all - Collect metrics for all active pipelines',
        metrics: 'GET /api/monitoring/metrics/:id - Get pipeline metrics history',
        overview: 'GET /api/monitoring/overview - Get all pipelines overview',
        health: 'GET /api/monitoring/health/:id - Check pipeline health',
        alerts: 'GET /api/monitoring/alerts - Get active alerts'
      }
    });
  } catch (error) {
    console.error('[Monitoring Controller] Test error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/monitoring/simple-collect/:id
 * Thu thập metrics đơn giản cho một pipeline
 */
export async function simpleCollectPipelineMetrics(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await simpleMonitoringService.collectPipelineMetrics(id);
    
    res.json({
      status: 'success',
      ...result
    });
    
  } catch (error) {
    console.error('[Simple Monitoring Controller] Collect pipeline metrics error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/simple-health/:id
 * Kiểm tra health đơn giản của pipeline
 */
export async function simpleGetPipelineHealth(req, res) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    const result = await simpleMonitoringService.getHealthStatus(id);
    
    res.json({
      status: 'success',
      pipeline_id: id,
      ...result
    });
    
  } catch (error) {
    console.error('[Simple Monitoring Controller] Get pipeline health error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/monitoring/scheduler/start
 * Start background monitoring scheduler
 */
export async function startMonitoringScheduler(req, res) {
  try {
    monitoringScheduler.start();
    const status = monitoringScheduler.getStatus();
    
    res.json({
      status: 'success',
      message: 'Monitoring scheduler started',
      scheduler_status: status
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
 * Stop background monitoring scheduler
 */
export async function stopMonitoringScheduler(req, res) {
  try {
    monitoringScheduler.stop();
    const status = monitoringScheduler.getStatus();
    
    res.json({
      status: 'success',
      message: 'Monitoring scheduler stopped',
      scheduler_status: status
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
 * Get monitoring scheduler status
 */
export async function getMonitoringSchedulerStatus(req, res) {
  try {
    const status = monitoringScheduler.getStatus();
    
    res.json({
      status: 'success',
      scheduler_status: status
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
 * Update monitoring collection interval
 */
export async function updateMonitoringInterval(req, res) {
  try {
    const { interval_seconds } = req.body;
    
    if (!interval_seconds || interval_seconds < 10) {
      return res.status(400).json({
        status: 'error',
        message: 'interval_seconds is required and must be >= 10'
      });
    }
    
    monitoringScheduler.setInterval(interval_seconds);
    const status = monitoringScheduler.getStatus();
    
    res.json({
      status: 'success',
      message: `Monitoring interval updated to ${interval_seconds} seconds`,
      scheduler_status: status
    });

  } catch (error) {
    console.error('[Monitoring Controller] Update interval error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * POST /api/monitoring/advanced-collect/:id
 * Thu thập metrics nâng cao cho một pipeline
 */
export async function collectAdvancedMetrics(req, res) {
  try {
    const { id: pipelineId } = req.params;
    
    if (!pipelineId) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    console.log(`📊 Starting advanced metrics collection for pipeline: ${pipelineId}`);
    
    const result = await advancedMonitoring.collectAdvancedMetrics(pipelineId);
    
    if (result.success) {
      res.json({
        status: 'success',
        ...result
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to collect advanced metrics',
        error: result.error,
        pipeline_id: pipelineId
      });
    }
  } catch (error) {
    console.error('Error in collectAdvancedMetrics:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/advanced-metrics/:id
 * Lấy lịch sử metrics nâng cao của một pipeline
 */
export async function getAdvancedMetrics(req, res) {
  try {
    const { id: pipelineId } = req.params;
    const { timeRange = '1 hour' } = req.query;
    
    if (!pipelineId) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    console.log(`📈 Getting advanced metrics history for pipeline: ${pipelineId}, timeRange: ${timeRange}`);
    
    const result = await advancedMonitoring.getAdvancedMetricsHistory(pipelineId, timeRange);
    
    if (result.success) {
      res.json({
        status: 'success',
        ...result
      });
    } else {
      res.status(500).json({
        status: 'error',
        message: 'Failed to get advanced metrics',
        error: result.error,
        pipeline_id: pipelineId
      });
    }
  } catch (error) {
    console.error('Error in getAdvancedMetrics:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * GET /api/monitoring/dashboard/:id
 * Lấy dashboard tóm tắt metrics của một pipeline
 */
export async function getMetricsDashboard(req, res) {
  try {
    const { id: pipelineId } = req.params;
    const { timeRange = '1 hour' } = req.query;
    
    if (!pipelineId) {
      return res.status(400).json({
        status: 'error',
        message: 'Pipeline ID is required'
      });
    }
    
    console.log(`📊 Getting metrics dashboard for pipeline: ${pipelineId}`);
    
    // Get advanced metrics
    const metricsResult = await advancedMonitoring.getAdvancedMetricsHistory(pipelineId, timeRange);
    
    if (!metricsResult.success) {
      return res.status(500).json({
        status: 'error',
        message: 'Failed to get metrics data',
        error: metricsResult.error
      });
    }
    
    // Calculate dashboard stats
    const dashboard = {
      pipeline_id: pipelineId,
      time_range: timeRange,
      last_updated: metricsResult.latest_collection,
      total_metrics: metricsResult.total_metrics,
      
      // Health overview
      health: {
        status: 'unknown',
        container_running: false,
        vector_healthy: false
      },
      
      // Performance overview
      performance: {
        cpu_percent: 0,
        memory_bytes: 0,
        network_in_bytes: 0,
        network_out_bytes: 0
      },
      
      // Throughput overview
      throughput: {
        events_per_second: 0,
        bytes_per_second: 0,
        total_events_processed: 0,
        total_bytes_processed: 0
      },
      
      // Error overview
      errors: {
        total_errors: 0,
        error_rate: 0,
        recent_errors: []
      },
      
      // Buffer overview
      buffer: {
        buffered_events: 0,
        utilization_percent: 0,
        max_capacity: 0
      }
    };
    
    // Process metrics by type
    if (metricsResult.summary) {
      // Health metrics
      if (metricsResult.summary.health) {
        const healthMetrics = metricsResult.summary.health.metrics;
        if (healthMetrics.vector_health_status) {
          const latest = healthMetrics.vector_health_status[0];
          dashboard.health.vector_healthy = parseFloat(latest.value) === 1.0;
        }
      }
      
      // Status metrics
      if (metricsResult.summary.status) {
        const statusMetrics = metricsResult.summary.status.metrics;
        if (statusMetrics.container_running) {
          const latest = statusMetrics.container_running[0];
          dashboard.health.container_running = parseFloat(latest.value) === 1.0;
        }
      }
      
      // Performance metrics
      if (metricsResult.summary.performance) {
        const perfMetrics = metricsResult.summary.performance.metrics;
        
        if (perfMetrics.container_cpu_percent) {
          dashboard.performance.cpu_percent = parseFloat(perfMetrics.container_cpu_percent[0].value);
        }
        
        if (perfMetrics.container_memory_bytes) {
          dashboard.performance.memory_bytes = parseFloat(perfMetrics.container_memory_bytes[0].value);
        }
        
        if (perfMetrics.container_network_in_bytes) {
          dashboard.performance.network_in_bytes = parseFloat(perfMetrics.container_network_in_bytes[0].value);
        }
        
        if (perfMetrics.container_network_out_bytes) {
          dashboard.performance.network_out_bytes = parseFloat(perfMetrics.container_network_out_bytes[0].value);
        }
      }
      
      // Throughput metrics
      if (metricsResult.summary.throughput) {
        const throughputMetrics = metricsResult.summary.throughput.metrics;
        
        // Find rate metrics
        Object.keys(throughputMetrics).forEach(metricName => {
          if (metricName.includes('events_rate')) {
            dashboard.throughput.events_per_second = parseFloat(throughputMetrics[metricName][0].value);
          }
          if (metricName.includes('bytes_rate')) {
            dashboard.throughput.bytes_per_second = parseFloat(throughputMetrics[metricName][0].value);
          }
          if (metricName.includes('events_total')) {
            dashboard.throughput.total_events_processed = parseFloat(throughputMetrics[metricName][0].value);
          }
          if (metricName.includes('bytes_total')) {
            dashboard.throughput.total_bytes_processed = parseFloat(throughputMetrics[metricName][0].value);
          }
        });
      }
      
      // Error metrics
      if (metricsResult.summary.error) {
        const errorMetrics = metricsResult.summary.error.metrics;
        
        Object.keys(errorMetrics).forEach(metricName => {
          if (metricName.includes('errors_total')) {
            dashboard.errors.total_errors += parseFloat(errorMetrics[metricName][0].value);
          }
        });
      }
      
      // Buffer metrics
      if (metricsResult.summary.buffer) {
        const bufferMetrics = metricsResult.summary.buffer.metrics;
        
        Object.keys(bufferMetrics).forEach(metricName => {
          if (metricName.includes('buffered_events')) {
            dashboard.buffer.buffered_events = parseFloat(bufferMetrics[metricName][0].value);
          }
          if (metricName.includes('utilization')) {
            dashboard.buffer.utilization_percent = parseFloat(bufferMetrics[metricName][0].value);
          }
        });
      }
    }
    
    // Determine overall health status
    if (dashboard.health.container_running && dashboard.health.vector_healthy) {
      dashboard.health.status = 'healthy';
    } else if (dashboard.health.container_running && !dashboard.health.vector_healthy) {
      dashboard.health.status = 'degraded';
    } else {
      dashboard.health.status = 'unhealthy';
    }
    
    res.json({
      status: 'success',
      dashboard: dashboard,
      raw_metrics: metricsResult.summary
    });
    
  } catch (error) {
    console.error('Error in getMetricsDashboard:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};