// Real-time Log Counter Service
// Theo dõi số lượng log real-time cho từng pipeline và source

import { EventEmitter } from 'events';
import { db } from '../configs/db.js';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Real-time Log Counter Service
 * Tracks log counts in real-time for each pipeline source
 */
class RealTimeLogCounterService extends EventEmitter {
  constructor() {
    super();
    this.counters = new Map(); // pipelineId -> { sourceId -> { http_count, file_count, last_updated } }
    this.vectorMetricsCache = new Map(); // Cache previous metrics for diff calculation
    this.isMonitoring = false;
    this.monitoringInterval = null;
    this.updateInterval = 5000; // 5 seconds default
  }

  /**
   * Start real-time monitoring for all pipelines
   */
  async startMonitoring(intervalMs = 5000) {
    if (this.isMonitoring) {
      return { success: false, message: 'Already monitoring' };
    }

    this.updateInterval = intervalMs;
    this.isMonitoring = true;

    // Start periodic metrics collection
    this.monitoringInterval = setInterval(async () => {
      await this.updateAllPipelineCounters();
    }, this.updateInterval);

    console.log(`🔄 [Real-time Counter] Started monitoring with ${intervalMs}ms interval`);
    
    return { 
      success: true, 
      message: 'Real-time monitoring started',
      interval_ms: intervalMs
    };
  }

  /**
   * Stop real-time monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return { success: false, message: 'Not currently monitoring' };
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    console.log('⏹️ [Real-time Counter] Stopped monitoring');
    
    return { success: true, message: 'Real-time monitoring stopped' };
  }

  /**
   * Update counters for all active pipelines
   */
  async updateAllPipelineCounters() {
    try {
      const client = await db.connect();
      
      try {        // Get all running custom pipelines
        const result = await client.query(
          'SELECT id, name, container_id, sources_config, exposed_ports FROM custom_pipelines WHERE status = $1 AND deleted = false',
          ['running']
        );

        for (const pipeline of result.rows) {
          try {
            await this.updatePipelineCounters(pipeline);
          } catch (error) {
            console.error(`❌ [Real-time Counter] Error updating pipeline ${pipeline.name}:`, error.message);
          }
        }
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ [Real-time Counter] Error in updateAllPipelineCounters:', error);
    }
  }  /**
   * Update counters for a specific pipeline
   */
  async updatePipelineCounters(pipeline) {
    const pipelineId = pipeline.id;
    const containerId = pipeline.container_id;

    if (!containerId) {
      return;
    }

    // Parse sources configuration
    const sourcesConfig = typeof pipeline.sources_config === 'string' 
      ? JSON.parse(pipeline.sources_config) 
      : pipeline.sources_config;

    // Get previous counts
    const previousCounts = this.counters.get(pipelineId) || {};
    
    // Calculate new counts for each source
    const newCounts = {};
    
    for (const [sourceId, sourceConfig] of Object.entries(sourcesConfig)) {
      const sourceType = sourceConfig.type;
      
      // Count HTTP logs
      if (sourceType === 'http') {
        const currentHttpEvents = await this.getLogCountFromContainer(pipelineId, sourceId, 'http');
        const previousHttpEvents = previousCounts[sourceId]?.total_count || 0;
        const httpDiff = Math.max(0, currentHttpEvents - previousHttpEvents);
        
        newCounts[sourceId] = {
          type: 'http',
          total_count: currentHttpEvents,
          new_count: httpDiff,
          last_updated: new Date()
        };
      }
      
      // Count File logs
      else if (sourceType === 'file') {
        const currentFileEvents = await this.getLogCountFromContainer(pipelineId, sourceId, 'file');
        const previousFileEvents = previousCounts[sourceId]?.total_count || 0;
        const fileDiff = Math.max(0, currentFileEvents - previousFileEvents);
        
        newCounts[sourceId] = {
          type: 'file',
          total_count: currentFileEvents,
          new_count: fileDiff,
          last_updated: new Date()
        };
      }
    }

    // Update counters map
    this.counters.set(pipelineId, newCounts);

    // Emit events for real-time updates
    if (Object.keys(newCounts).length > 0) {
      this.emit('counters_updated', {
        pipelineId,
        pipelineName: pipeline.name,
        counters: newCounts
      });
    }
  }

  /**
   * Get current counts for a specific pipeline
   */
  getCurrentCounts(pipelineId) {
    const counts = this.counters.get(pipelineId);
    
    if (!counts) {
      return {
        success: false,
        message: 'Pipeline not found or not being monitored'
      };
    }

    return {
      success: true,
      pipeline_id: pipelineId,
      sources: counts,
      last_updated: Math.max(...Object.values(counts).map(c => c.last_updated)),
      monitoring_status: this.isMonitoring ? 'active' : 'inactive'
    };
  }

  /**
   * Get counts for all monitored pipelines
   */
  getAllCounts() {
    const allCounts = {};
    
    for (const [pipelineId, counts] of this.counters.entries()) {
      allCounts[pipelineId] = counts;
    }

    return {
      success: true,
      pipelines: allCounts,
      total_pipelines: this.counters.size,
      monitoring_status: this.isMonitoring ? 'active' : 'inactive',
      update_interval_ms: this.updateInterval
    };
  }

  /**
   * Force update counters for a specific pipeline
   */
  async forceUpdatePipeline(pipelineId) {
    try {
      const client = await db.connect();
      
      try {        const result = await client.query(
          'SELECT id, name, container_id, sources_config, exposed_ports FROM custom_pipelines WHERE id = $1 AND status = $2 AND deleted = false',
          [pipelineId, 'running']
        );

        if (result.rows.length === 0) {
          return {
            success: false,
            message: 'Pipeline not found or not running'
          };
        }

        await this.updatePipelineCounters(result.rows[0]);
        
        return {
          success: true,
          message: 'Pipeline counters updated',
          counts: this.getCurrentCounts(pipelineId)
        };
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('❌ [Real-time Counter] Error in forceUpdatePipeline:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Reset counters for a pipeline
   */
  resetPipelineCounters(pipelineId) {
    this.counters.delete(pipelineId);
    this.vectorMetricsCache.delete(pipelineId);
    
    return {
      success: true,
      message: `Counters reset for pipeline ${pipelineId}`
    };
  }

  /**
   * Helper: Get container IP
   */
  async getContainerIP(containerId) {
    try {
      const { stdout } = await execAsync(
        `docker inspect ${containerId} --format="{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"`
      );
      return stdout.trim();
    } catch (error) {
      console.error(`❌ [Real-time Counter] Cannot get IP for container ${containerId}:`, error.message);
      return null;
    }
  }  /**
   * Helper: Get Vector API port for a pipeline
   */
  getVectorApiPort(pipeline) {
    try {
      const exposedPorts = typeof pipeline.exposed_ports === 'string' 
        ? JSON.parse(pipeline.exposed_ports) 
        : pipeline.exposed_ports;
      
      if (Array.isArray(exposedPorts)) {
        const apiPort = exposedPorts.find(port => port.type === 'api');
        return apiPort ? apiPort.port : null;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ [Real-time Counter] Error parsing exposed ports:`, error.message);
      return null;
    }
  }

  /**
   * Helper: Fetch metrics from Vector using GraphQL
   */
  async fetchVectorMetrics(pipeline) {
    const vectorApiPort = this.getVectorApiPort(pipeline);
    
    if (!vectorApiPort) {
      console.error(`❌ [Real-time Counter] No Vector API port found for pipeline ${pipeline.id}`);
      return null;
    }
    
    try {
      const query = {
        query: `{
          components {
            nodes {
              componentId
              componentType
            }
          }
        }`
      };
      
      const response = await fetch(`http://localhost:${vectorApiPort}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
        timeout: 5000
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return this.parseGraphQLMetrics(result.data);
    } catch (error) {
      console.error(`❌ [Real-time Counter] Error fetching metrics from localhost:${vectorApiPort}/graphql:`, error.message);
      return null;
    }
  }

  /**
   * Helper: Parse GraphQL metrics response
   */
  parseGraphQLMetrics(data) {
    const metrics = {};
    
    if (data && data.components && data.components.nodes) {
      data.components.nodes.forEach(component => {
        // For now, just track component existence
        // We'll need to get metrics differently since the direct metrics query seems not supported
        metrics[`component_${component.componentId}`] = {
          value: 1, // Component exists
          labels: {
            component_id: component.componentId,
            component_type: component.componentType
          }
        };
      });
    }
    
    return metrics;
  }  /**
   * Helper: Extract metric value for specific source using log counting
   */
  async extractMetricValue(metrics, pipelineId, sourceId, metricType) {
    // Since Vector's GraphQL doesn't expose direct event counts,
    // we'll use container log counting approach
    return await this.getLogCountFromContainer(pipelineId, sourceId, metricType);
  }/**
   * Helper: Count logs from Vector container logs
   */
  async getLogCountFromContainer(pipelineId, sourceId, metricType) {
    try {
      const containerName = `vector_${pipelineId}`;
      
      // Get container logs and count messages by type
      const { stdout } = await execAsync(
        `docker logs ${containerName} 2>&1`
      );
      
      let logPattern;
      if (metricType === 'http') {
        // Count occurrences of HTTP log messages
        logPattern = /"source_type":"http_server"/g;
      } else if (metricType === 'file') {
        // Count occurrences of file log messages
        logPattern = /"source_type":"file"/g;
      } else {
        return 0;
      }
      
      const matches = stdout.match(logPattern);
      const count = matches ? matches.length : 0;
      
      console.log(`📊 [Real-time Counter] Counted ${count} ${metricType} logs for source ${sourceId} in pipeline ${pipelineId}`);
      return count;
    } catch (error) {
      console.error(`❌ [Real-time Counter] Error counting logs:`, error.message);
      return 0;
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      is_monitoring: this.isMonitoring,
      update_interval_ms: this.updateInterval,
      monitored_pipelines: this.counters.size,
      cached_metrics: this.vectorMetricsCache.size
    };
  }
}

// Export singleton instance
export const realTimeCounterService = new RealTimeLogCounterService();
export default realTimeCounterService;
