// monitoring.service.simple.js
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../configs/db.js';

const execAsync = promisify(exec);

/**
 * Simple Vector metrics collector using basic approach
 */
class SimpleVectorMetricsCollector {
  constructor() {
    this.basePort = 8686;
  }

  /**
   * Get container IP for Vector API
   */
  async getContainerIP(pipelineId) {
    const containerName = `vector_${pipelineId}`;
    try {
      const { stdout } = await execAsync(
        `docker inspect ${containerName} --format="{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"`
      );
      return stdout.trim();
    } catch (error) {
      throw new Error(`Cannot get container IP for ${containerName}: ${error.message}`);
    }
  }

  /**
   * Test Vector health endpoint
   */
  async getHealthStatus(pipelineId) {
    try {
      const containerIP = await this.getContainerIP(pipelineId);
      const healthURL = `http://${containerIP}:8686/health`;
      
      console.log(`[Monitoring] Checking health: ${healthURL}`);
      
      const response = await fetch(healthURL);
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const health = await response.text();
      console.log(`[Monitoring] Health response: ${health}`);
      
      return {
        healthy: health.includes('True') || health.includes('ok'),
        status: health,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`[Monitoring] Health check error:`, error.message);
      return {
        healthy: false,
        status: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get container stats as metrics
   */
  async getContainerStats(pipelineId) {
    try {
      const containerName = `vector_${pipelineId}`;
      const { stdout } = await execAsync(`docker stats ${containerName} --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"`);
      
      console.log(`[Monitoring] Container stats: ${stdout}`);
      
      return {
        stats: stdout,
        timestamp: new Date()
      };
    } catch (error) {
      console.error(`[Monitoring] Container stats error:`, error.message);
      return {
        stats: 'unavailable',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

/**
 * Simple monitoring service
 */
export class SimpleMonitoringService {
  constructor() {
    this.collector = new SimpleVectorMetricsCollector();
  }

  /**
   * Collect basic metrics for a pipeline
   */
  async collectPipelineMetrics(pipelineId) {
    const client = await db.connect();
    
    try {
      console.log(`[Simple Monitoring] Collecting metrics for pipeline: ${pipelineId}`);
      
      // Get health status
      const healthData = await this.collector.getHealthStatus(pipelineId);
      
      // Get container stats  
      const statsData = await this.collector.getContainerStats(pipelineId);
      
      const metrics = [];
      const now = new Date();

      // Save health metric
      metrics.push({
        pipeline_id: pipelineId,
        metric_type: 'health',
        metric_name: 'vector_health_status',
        metric_value: healthData.healthy ? 1 : 0,
        unit: 'boolean',
        collected_at: now
      });

      // Save basic status metric
      metrics.push({
        pipeline_id: pipelineId,
        metric_type: 'status',
        metric_name: 'container_running',
        metric_value: 1, // If we got here, container is running
        unit: 'boolean',
        collected_at: now
      });

      // Save metrics to database
      if (metrics.length > 0) {
        const insertQuery = `
          INSERT INTO pipeline_metrics (pipeline_id, metric_type, metric_name, metric_value, unit, collected_at)
          VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        for (const metric of metrics) {
          await client.query(insertQuery, [
            metric.pipeline_id,
            metric.metric_type,
            metric.metric_name,
            metric.metric_value,
            metric.unit,
            metric.collected_at
          ]);
        }
        
        console.log(`[Simple Monitoring] Saved ${metrics.length} metrics for pipeline ${pipelineId}`);
      }

      return {
        success: true,
        pipeline_id: pipelineId,
        metrics_collected: metrics.length,
        health_data: healthData,
        stats_data: statsData,
        timestamp: now
      };

    } catch (error) {
      console.error(`[Simple Monitoring] Error collecting metrics for ${pipelineId}:`, error);
      return {
        success: false,
        pipeline_id: pipelineId,
        error: error.message,
        metrics_collected: 0,
        timestamp: new Date()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get pipeline metrics from database
   */
  async getPipelineMetrics(pipelineId, timeRange = '1 hour', metricTypes = null) {
    const client = await db.connect();
    
    try {
      let query = `
        SELECT metric_type, metric_name, metric_value, unit, collected_at
        FROM pipeline_metrics 
        WHERE pipeline_id = $1 
        AND collected_at >= NOW() - INTERVAL '${timeRange}'
      `;
      
      const params = [pipelineId];
      
      if (metricTypes && metricTypes.length > 0) {
        query += ` AND metric_type = ANY($2)`;
        params.push(metricTypes);
      }
      
      query += ` ORDER BY collected_at DESC`;
      
      const { rows } = await client.query(query, params);
      
      return {
        success: true,
        pipeline_id: pipelineId,
        time_range: timeRange,
        metrics_count: rows.length,
        metrics: rows
      };

    } catch (error) {
      console.error(`[Simple Monitoring] Error getting metrics for ${pipelineId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get health status for a pipeline
   */
  async getHealthStatus(pipelineId) {
    try {
      console.log(`[Simple Monitoring] Getting health status for pipeline: ${pipelineId}`);
      
      // Delegate to collector
      const healthData = await this.collector.getHealthStatus(pipelineId);
      
      return {
        success: true,
        pipeline_id: pipelineId,
        ...healthData
      };
      
    } catch (error) {
      console.error(`[Simple Monitoring] Error getting health status for ${pipelineId}:`, error);
      return {
        success: false,
        pipeline_id: pipelineId,
        healthy: false,
        status: error.message,
        timestamp: new Date()
      };
    }
  }
}

// Export simple instance for testing
export const simpleMonitoringService = new SimpleMonitoringService();
