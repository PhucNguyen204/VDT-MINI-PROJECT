// monitoring.scheduler.js
import { MonitoringService } from './monitoring.service.new.js';
import { db } from '../configs/db.js';

/**
 * Background monitoring scheduler
 */
class MonitoringScheduler {
  constructor() {
    this.monitoring = new MonitoringService();
    this.intervalId = null;
    this.collectInterval = 30 * 1000; // Default 30 seconds
    this.isRunning = false;
  }

  /**
   * Start background monitoring
   */
  start() {
    if (this.isRunning) {
      console.log('[Monitoring Scheduler] Already running');
      return;
    }

    console.log(`[Monitoring Scheduler] Starting background monitoring every ${this.collectInterval/1000}s`);
    
    this.intervalId = setInterval(async () => {
      await this.collectAllMetrics();
    }, this.collectInterval);
    
    this.isRunning = true;
    
    // Collect immediately on start
    setTimeout(() => this.collectAllMetrics(), 1000);
  }

  /**
   * Stop background monitoring
   */
  stop() {
    if (!this.isRunning) {
      console.log('[Monitoring Scheduler] Not running');
      return;
    }

    console.log('[Monitoring Scheduler] Stopping background monitoring');
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.isRunning = false;
  }

  /**
   * Collect metrics for all active pipelines
   */
  async collectAllMetrics() {
    try {
      const client = await db.connect();
      
      try {
        const result = await client.query(
          'SELECT id, name FROM pipelines WHERE deleted = false AND active = true'
        );
        
        const pipelines = result.rows;
        console.log(`🔄 Found ${pipelines.length} active pipelines to monitor`);
        
        if (pipelines.length === 0) {
          console.log('⚠️ No active pipelines found for monitoring');
          return;
        }
        
        // Collect metrics for each pipeline
        for (const pipeline of pipelines) {
          try {
            console.log(`📊 Collecting metrics for pipeline: ${pipeline.name} (${pipeline.id})`);
            
            const result = await this.monitoring.collectPipelineMetrics(pipeline.id);
            
            if (result.success) {
              console.log(`✅ Successfully collected ${result.metrics_collected} metrics for ${pipeline.name}`);
            } else {
              console.error(`❌ Failed to collect metrics for ${pipeline.name}:`, result.error);
            }
            
            // Small delay between pipeline collections
            await new Promise(resolve => setTimeout(resolve, 1000));
            
          } catch (error) {
            console.error(`❌ Error collecting metrics for pipeline ${pipeline.name}:`, error.message);
          }
        }
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Error in collectAllMetrics:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.isRunning,
      interval_seconds: this.collectInterval / 1000,
      next_collection: this.isRunning ? new Date(Date.now() + this.collectInterval) : null
    };
  }

  /**
   * Update collection interval
   */
  setInterval(intervalSeconds) {
    this.collectInterval = intervalSeconds * 1000;
    
    if (this.isRunning) {
      console.log(`[Monitoring Scheduler] Updating interval to ${intervalSeconds}s, restarting...`);
      this.stop();
      this.start();
    }
  }
}

// Export singleton instance
export const monitoringScheduler = new MonitoringScheduler();
