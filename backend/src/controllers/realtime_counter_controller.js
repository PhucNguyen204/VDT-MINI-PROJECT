// Real-time Log Counter Controller
// API endpoints để lấy số đếm log real-time

import { realTimeCounterService } from '../services/realtime_counter_service.js';

/**
 * Start real-time log counting
 * POST /api/realtime-counter/start
 * Body: { interval_ms?: number }
 */
export async function startRealTimeCounter(req, res) {
  try {
    const { interval_ms = 5000 } = req.body;

    // Validate interval
    if (interval_ms < 1000) {
      return res.status(400).json({
        success: false,
        error: 'Interval must be at least 1000ms (1 second)'
      });
    }

    if (interval_ms > 60000) {
      return res.status(400).json({
        success: false,
        error: 'Interval cannot exceed 60000ms (1 minute)'
      });
    }

    const result = await realTimeCounterService.startMonitoring(interval_ms);

    res.json({
      success: result.success,
      message: result.message,
      data: {
        interval_ms: result.interval_ms,
        started_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error starting real-time counter:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Stop real-time log counting
 * POST /api/realtime-counter/stop
 */
export async function stopRealTimeCounter(req, res) {
  try {
    const result = realTimeCounterService.stopMonitoring();

    res.json({
      success: result.success,
      message: result.message,
      data: {
        stopped_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error stopping real-time counter:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get current log counts for a specific pipeline
 * GET /api/realtime-counter/counts/:pipelineId
 */
export async function getPipelineLogCounts(req, res) {
  try {
    const { pipelineId } = req.params;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID is required'
      });
    }

    const result = realTimeCounterService.getCurrentCounts(pipelineId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting pipeline log counts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get log counts for all monitored pipelines
 * GET /api/realtime-counter/counts
 */
export async function getAllPipelineLogCounts(req, res) {
  try {
    const result = realTimeCounterService.getAllCounts();

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting all pipeline log counts:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Force update counters for a specific pipeline
 * POST /api/realtime-counter/update/:pipelineId
 */
export async function forceUpdatePipelineCounters(req, res) {
  try {
    const { pipelineId } = req.params;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID is required'
      });
    }

    const result = await realTimeCounterService.forceUpdatePipeline(pipelineId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json({
      success: true,
      message: 'Pipeline counters updated successfully',
      data: result.counts
    });

  } catch (error) {
    console.error('Error force updating pipeline counters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Reset counters for a specific pipeline
 * POST /api/realtime-counter/reset/:pipelineId
 */
export async function resetPipelineCounters(req, res) {
  try {
    const { pipelineId } = req.params;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID is required'
      });
    }

    const result = realTimeCounterService.resetPipelineCounters(pipelineId);

    res.json({
      success: true,
      message: result.message,
      data: {
        pipeline_id: pipelineId,
        reset_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error resetting pipeline counters:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get real-time counter status
 * GET /api/realtime-counter/status
 */
export async function getRealTimeCounterStatus(req, res) {
  try {
    const status = realTimeCounterService.getStatus();

    res.json({
      success: true,
      data: {
        status: status,
        server_time: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting real-time counter status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Get log count summary with human-readable format
 * GET /api/realtime-counter/summary/:pipelineId
 */
export async function getPipelineLogCountSummary(req, res) {
  try {
    const { pipelineId } = req.params;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID is required'
      });
    }

    const result = realTimeCounterService.getCurrentCounts(pipelineId);

    if (!result.success) {
      return res.status(404).json(result);
    }

    // Format for human-readable response
    const summary = {
      pipeline_id: pipelineId,
      monitoring_active: result.monitoring_status === 'active',
      sources: {}
    };

    Object.entries(result.sources).forEach(([sourceId, data]) => {
      summary.sources[sourceId] = {
        source_type: data.type,
        total_logs_received: data.total_count,
        new_logs_since_last_check: data.new_count,
        last_updated: data.last_updated,
        message: data.new_count > 0 
          ? `${data.new_count} new log(s) received via ${data.type.toUpperCase()}`
          : `No new logs since last check`
      };
    });

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Error getting pipeline log count summary:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
