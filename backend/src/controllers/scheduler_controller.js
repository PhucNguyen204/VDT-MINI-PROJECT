// Custom Pipeline Scheduler Controller
import { customScheduler } from '../services/scheduler.service.js';

/**
 * Controller for automated metrics collection scheduling
 */
class SchedulerController {
  
  /**
   * Start automatic metrics collection
   * POST /api/scheduler/start
   * Body: { interval_seconds?: number }
   */
  async startScheduler(req, res) {
    try {
      const { interval_seconds = 30 } = req.body;

      // Validate interval
      if (interval_seconds < 10) {
        return res.status(400).json({
          success: false,
          error: 'Interval must be at least 10 seconds'
        });
      }

      if (interval_seconds > 86400) { // 24 hours
        return res.status(400).json({
          success: false,
          error: 'Interval cannot exceed 24 hours (86400 seconds)'
        });
      }

      const result = await customScheduler.start(interval_seconds);

      res.json({
        success: true,
        message: result.message,
        data: {
          status: result.status,
          interval_seconds: result.interval_seconds,
          started_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error starting scheduler:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Stop automatic metrics collection
   * POST /api/scheduler/stop
   */
  async stopScheduler(req, res) {
    try {
      const result = customScheduler.stop();

      res.json({
        success: true,
        message: result.message,
        data: {
          status: result.status,
          stats: result.stats,
          stopped_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error stopping scheduler:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Update scheduler interval
   * PUT /api/scheduler/interval
   * Body: { interval_seconds: number }
   */
  async updateInterval(req, res) {
    try {
      const { interval_seconds } = req.body;

      if (!interval_seconds || typeof interval_seconds !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'interval_seconds is required and must be a number'
        });
      }

      // Validate interval
      if (interval_seconds < 10) {
        return res.status(400).json({
          success: false,
          error: 'Interval must be at least 10 seconds'
        });
      }

      if (interval_seconds > 86400) { // 24 hours
        return res.status(400).json({
          success: false,
          error: 'Interval cannot exceed 24 hours (86400 seconds)'
        });
      }

      const result = await customScheduler.updateInterval(interval_seconds);

      res.json({
        success: true,
        message: result.message,
        data: {
          status: result.status,
          interval_seconds: result.interval_seconds,
          updated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error updating scheduler interval:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get scheduler status
   * GET /api/scheduler/status
   */
  async getStatus(req, res) {
    try {
      const status = customScheduler.getStatus();

      res.json({
        success: true,
        data: {
          scheduler: status,
          server_time: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error getting scheduler status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Trigger manual metrics collection
   * POST /api/scheduler/trigger
   */
  async triggerCollection(req, res) {
    try {
      const result = await customScheduler.triggerCollection();

      res.json({
        success: true,
        message: 'Manual metrics collection triggered',
        data: result
      });

    } catch (error) {
      console.error('Error triggering manual collection:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Reset scheduler statistics
   * POST /api/scheduler/reset-stats
   */
  async resetStats(req, res) {
    try {
      const result = customScheduler.resetStats();

      res.json({
        success: true,
        message: result.message,
        data: {
          reset_at: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error resetting scheduler stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get scheduler configuration and recommendations
   * GET /api/scheduler/config
   */
  async getConfig(req, res) {
    try {
      const status = customScheduler.getStatus();

      res.json({
        success: true,
        data: {
          current_config: {
            is_running: status.is_running,
            interval_seconds: status.interval_seconds,
            last_collection: status.last_collection,
            next_collection: status.next_collection
          },
          recommendations: {
            minimum_interval: 10,
            maximum_interval: 86400,
            recommended_intervals: [
              { seconds: 30, description: 'High frequency (30s) - For active monitoring' },
              { seconds: 60, description: 'Standard (1 min) - Default monitoring' },
              { seconds: 300, description: 'Medium (5 min) - Light monitoring' },
              { seconds: 900, description: 'Low (15 min) - Basic monitoring' }
            ]
          },
          stats: status.stats
        }
      });

    } catch (error) {
      console.error('Error getting scheduler config:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export const schedulerController = new SchedulerController();
export default schedulerController;
