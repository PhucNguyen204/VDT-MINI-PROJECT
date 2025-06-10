// Custom Pipeline Metrics Scheduler Service
import { customMonitorService } from './monitor_service.js';
import { db } from '../configs/db.js';

/**
 * Background monitoring scheduler cho custom pipelines
 */
class CustomMonitoringScheduler {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.intervalSeconds = 30; // Default 30 seconds
    this.lastCollectionTime = null;
    this.collectionStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null
    };
  }

  /**
   * Bắt đầu tự động thu thập metrics
   */
  async start(intervalSeconds = 30) {
    if (this.isRunning) {
      throw new Error('Scheduler is already running');
    }

    this.intervalSeconds = intervalSeconds;
    console.log(`🚀 [Scheduler] Starting automatic metrics collection every ${intervalSeconds} seconds`);

    // Collect immediately on start
    await this.collectAllMetrics();

    // Set up interval
    this.intervalId = setInterval(async () => {
      await this.collectAllMetrics();
    }, intervalSeconds * 1000);

    this.isRunning = true;
    
    return {
      success: true,
      message: `Automatic metrics collection started with ${intervalSeconds}s interval`,
      interval_seconds: intervalSeconds,
      status: 'running'
    };
  }

  /**
   * Dừng tự động thu thập metrics
   */
  stop() {
    if (!this.isRunning) {
      throw new Error('Scheduler is not running');
    }

    clearInterval(this.intervalId);
    this.intervalId = null;
    this.isRunning = false;

    console.log('⏹️ [Scheduler] Stopped automatic metrics collection');

    return {
      success: true,
      message: 'Automatic metrics collection stopped',
      status: 'stopped',
      stats: this.collectionStats
    };
  }

  /**
   * Cập nhật thời gian interval
   */
  async updateInterval(newIntervalSeconds) {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.intervalSeconds = newIntervalSeconds;

    if (wasRunning) {
      await this.start(newIntervalSeconds);
    }

    return {
      success: true,
      message: `Interval updated to ${newIntervalSeconds} seconds`,
      interval_seconds: newIntervalSeconds,
      status: this.isRunning ? 'running' : 'stopped'
    };
  }

  /**
   * Lấy trạng thái hiện tại của scheduler
   */
  getStatus() {
    return {
      is_running: this.isRunning,
      interval_seconds: this.intervalSeconds,
      last_collection: this.lastCollectionTime,
      next_collection: this.isRunning ? 
        new Date(Date.now() + this.intervalSeconds * 1000).toISOString() : null,
      stats: this.collectionStats,
      uptime_seconds: this.isRunning ? 
        Math.floor((Date.now() - (this.lastCollectionTime ? new Date(this.lastCollectionTime).getTime() : Date.now())) / 1000) : 0
    };
  }

  /**
   * Thu thập metrics cho tất cả custom pipelines đang chạy
   */
  async collectAllMetrics() {
    const startTime = new Date();
    console.log(`📊 [Scheduler] Starting metrics collection at ${startTime.toISOString()}`);
    
    try {
      this.collectionStats.totalRuns++;

      // Get all running custom pipelines
      const client = await db.connect();
      
      try {
        const result = await client.query(
          'SELECT id, name FROM custom_pipelines WHERE deleted = false AND status = $1',
          ['running']
        );

        const pipelines = result.rows;
        console.log(`🔄 [Scheduler] Found ${pipelines.length} running custom pipelines to monitor`);

        if (pipelines.length === 0) {
          console.log('⚠️ [Scheduler] No running custom pipelines found');
          this.collectionStats.successfulRuns++;
          this.lastCollectionTime = startTime.toISOString();
          return {
            success: true,
            pipelines_count: 0,
            message: 'No running custom pipelines found',
            metrics_collected: 0,
            collection_time: startTime.toISOString()
          };
        }

        let totalMetricsCollected = 0;
        const results = [];

        // Collect metrics for each pipeline
        for (const pipeline of pipelines) {
          try {
            console.log(`📈 [Scheduler] Collecting metrics for pipeline: ${pipeline.name} (${pipeline.id})`);
            
            const result = await customMonitorService.collectCustomPipelineMetrics(pipeline.id);
            
            results.push({
              pipeline_id: pipeline.id,
              pipeline_name: pipeline.name,
              success: result.success,
              metrics_collected: result.metrics_collected || 0
            });

            if (result.success) {
              totalMetricsCollected += result.metrics_collected || 0;
              console.log(`✅ [Scheduler] Successfully collected ${result.metrics_collected || 0} metrics for ${pipeline.name}`);
            } else {
              console.error(`❌ [Scheduler] Failed to collect metrics for ${pipeline.name}:`, result.error);
            }

            // Small delay between pipeline collections
            await new Promise(resolve => setTimeout(resolve, 1000));

          } catch (error) {
            console.error(`❌ [Scheduler] Error collecting metrics for pipeline ${pipeline.name}:`, error.message);
            results.push({
              pipeline_id: pipeline.id,
              pipeline_name: pipeline.name,
              success: false,
              error: error.message
            });
          }
        }

        this.collectionStats.successfulRuns++;
        this.lastCollectionTime = startTime.toISOString();

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();

        console.log(`✅ [Scheduler] Completed metrics collection in ${duration}ms. Total metrics: ${totalMetricsCollected}`);

        return {
          success: true,
          pipelines_count: pipelines.length,
          metrics_collected: totalMetricsCollected,
          results: results,
          collection_time: startTime.toISOString(),
          duration_ms: duration
        };

      } finally {
        client.release();
      }

    } catch (error) {
      this.collectionStats.failedRuns++;
      this.collectionStats.lastError = error.message;
      
      console.error('❌ [Scheduler] Error in collectAllMetrics:', error);
      
      return {
        success: false,
        error: error.message,
        collection_time: startTime.toISOString()
      };
    }
  }

  /**
   * Chạy một lần thu thập metrics (manual trigger)
   */
  async triggerCollection() {
    console.log('🔄 [Scheduler] Manual metrics collection triggered');
    const result = await this.collectAllMetrics();
    
    return {
      ...result,
      triggered_manually: true
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.collectionStats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastError: null
    };
    
    return {
      success: true,
      message: 'Statistics reset successfully'
    };
  }
}

// Export singleton instance
export const customScheduler = new CustomMonitoringScheduler();
export default customScheduler;
