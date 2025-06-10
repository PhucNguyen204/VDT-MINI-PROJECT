// custom_monitor.service.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { db } from '../configs/db.js';

const execAsync = promisify(exec);

/**
 * Vector metrics collector for Custom Pipelines
 */
class CustomVectorMetricsCollector {
  constructor() {
    this.basePort = 8686;
  }

  /**
   * Get container IP for Vector API from custom pipeline
   */
  async getContainerIP(pipelineId) {
    try {
      // Lấy container_id từ custom_pipelines table
      const client = await db.connect();
      const result = await client.query(
        'SELECT container_id FROM custom_pipelines WHERE id = $1 AND deleted = false',
        [pipelineId]
      );
      client.release();

      if (result.rows.length === 0) {
        throw new Error(`Custom pipeline ${pipelineId} not found`);
      }

      const containerId = result.rows[0].container_id;
      if (!containerId) {
        throw new Error(`Custom pipeline ${pipelineId} has no container`);
      }

      // Get container IP
      const { stdout } = await execAsync(
        `docker inspect ${containerId} --format="{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"`
      );
      
      const ip = stdout.trim();
      if (!ip) {
        throw new Error(`Cannot get IP for container ${containerId}`);
      }
      
      return ip;
    } catch (error) {
      throw new Error(`Cannot get container IP for custom pipeline ${pipelineId}: ${error.message}`);
    }
  }

  /**
   * Health check via REST API
   */
  async getHealthStatus(pipelineId) {
    try {
      const containerIP = await this.getContainerIP(pipelineId);
      const response = await fetch(`http://${containerIP}:${this.basePort}/health`, {
        timeout: 10000
      });
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        healthy: data.ok === true,
        status: JSON.stringify(data),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error fetching health status:', error);
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get Prometheus metrics from Vector
   */
  async getPrometheusMetrics(pipelineId) {
    try {
      const containerIP = await this.getContainerIP(pipelineId);
      const response = await fetch(`http://${containerIP}:${this.basePort}/metrics`, {
        timeout: 15000
      });
      
      if (!response.ok) {
        throw new Error(`Metrics endpoint failed: ${response.status}`);
      }
      
      const metricsText = await response.text();
      return this.parsePrometheusMetrics(metricsText);
    } catch (error) {
      console.error('Error fetching Prometheus metrics:', error);
      return {};
    }
  }

  /**
   * Parse Prometheus metrics format
   */
  parsePrometheusMetrics(metricsText) {
    const metrics = {};
    const lines = metricsText.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('#') || line.trim() === '') continue;
      
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})?)?\s+([0-9.-]+)$/);
      if (match) {
        const [, metricName, value] = match;
        if (metricName) {
          metrics[metricName] = parseFloat(value);
        }
      }
    }
    
    return metrics;
  }

  /**
   * Get detailed metrics via GraphQL
   */
  async getGraphQLMetrics(pipelineId) {
    try {
      const containerIP = await this.getContainerIP(pipelineId);
      
      const query = `
        query {
          components {
            componentId
            componentType
            outputs {
              outputId
              sentEventsTotal
              sentBytesTotal
            }
            sources {
              outputId
              receivedEventsTotal
              receivedBytesTotal
            }
            sinks {
              inputId
              receivedEventsTotal
              receivedBytesTotal
              errorEventsTotal
            }
          }
          health {
            status
          }
        }
      `;
      
      const response = await fetch(`http://${containerIP}:${this.basePort}/graphql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
        timeout: 15000
      });
      
      if (!response.ok) {
        throw new Error(`GraphQL query failed: ${response.status}`);
      }
      
      const result = await response.json();
      return result.data || {};
    } catch (error) {
      console.error('Error fetching GraphQL metrics:', error);
      return {};
    }
  }

  /**
   * Get container stats (CPU, Memory, Network, I/O)
   */
  async getContainerStats(pipelineId) {
    try {
      // Get container_id from database
      const client = await db.connect();
      const result = await client.query(
        'SELECT container_id FROM custom_pipelines WHERE id = $1 AND deleted = false',
        [pipelineId]
      );
      client.release();

      if (result.rows.length === 0) {
        throw new Error(`Custom pipeline ${pipelineId} not found`);
      }

      const containerId = result.rows[0].container_id;
      if (!containerId) {
        return {
          stats: 'no container',
          error: 'Pipeline has no container',
          timestamp: new Date()
        };
      }

      const { stdout } = await execAsync(
        `docker stats ${containerId} --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"`
      );
      
      const lines = stdout.trim().split('\n');
      if (lines.length >= 2) {
        const [header, data] = lines;
        return {
          stats: data,
          raw_output: stdout,
          timestamp: new Date()
        };
      }
      
      return {
        stats: 'no data',
        raw_output: stdout,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        stats: 'unavailable',
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Calculate throughput rates between current and previous metrics
   */
  calculateRates(currentMetrics, previousMetrics, timeDiff) {
    const rates = {};
    
    if (!previousMetrics || timeDiff <= 0) return rates;
    
    // Calculate events/sec and bytes/sec rates
    Object.keys(currentMetrics).forEach(key => {
      if (key.includes('events_total') && previousMetrics[key] !== undefined) {
        const eventsDiff = currentMetrics[key] - previousMetrics[key];
        const rate = eventsDiff / (timeDiff / 1000); // events per second
        rates[key.replace('_total', '_rate')] = Math.max(0, rate);
      }
      
      if (key.includes('bytes_total') && previousMetrics[key] !== undefined) {
        const bytesDiff = currentMetrics[key] - previousMetrics[key];
        const rate = bytesDiff / (timeDiff / 1000); // bytes per second
        rates[key.replace('_total', '_rate')] = Math.max(0, rate);
      }
    });
    
    return rates;
  }
}

/**
 * Custom Pipeline Monitoring Service
 */
export class CustomMonitorService {
  constructor() {
    this.collector = new CustomVectorMetricsCollector();
    this.previousMetrics = new Map(); // Store previous metrics for rate calculation
  }
  
  /**
   * Collect comprehensive metrics for a custom pipeline
   */
  async collectCustomPipelineMetrics(pipelineId) {
    const client = await db.connect();
    const collectTimestamp = new Date();
    
    try {
      console.log(`🔍 [Custom Monitor] Collecting metrics for pipeline: ${pipelineId}`);
      
      // Verify pipeline exists and is active
      const pipelineResult = await client.query(
        'SELECT id, name, status, container_id FROM custom_pipelines WHERE id = $1 AND deleted = false',
        [pipelineId]
      );
      
      if (pipelineResult.rows.length === 0) {
        throw new Error(`Custom pipeline ${pipelineId} not found`);
      }
      
      const pipeline = pipelineResult.rows[0];
      
      if (pipeline.status !== 'running') {
        console.warn(`⚠️ Pipeline ${pipeline.name} is not running (status: ${pipeline.status})`);
        return {
          success: false,
          pipeline_id: pipelineId,
          error: `Pipeline is not running (status: ${pipeline.status})`,
          timestamp: collectTimestamp
        };
      }

      // 1. Get health status
      const healthData = await this.collector.getHealthStatus(pipelineId);
      
      // 2. Get container stats
      const statsData = await this.collector.getContainerStats(pipelineId);
      
      // 3. Get Prometheus metrics
      const prometheusMetrics = await this.collector.getPrometheusMetrics(pipelineId);
      
      // 4. Get GraphQL metrics
      const graphqlMetrics = await this.collector.getGraphQLMetrics(pipelineId);
      
      // 5. Calculate rates
      const previousKey = `custom_${pipelineId}_previous`;
      const previousMetrics = this.previousMetrics.get(previousKey);
      const previousTimestamp = this.previousMetrics.get(`${previousKey}_timestamp`);
      
      let rates = {};
      if (previousMetrics && previousTimestamp) {
        const timeDiff = collectTimestamp.getTime() - previousTimestamp.getTime();
        rates = this.collector.calculateRates(prometheusMetrics, previousMetrics, timeDiff);
      }
      
      // Store current metrics for next calculation
      this.previousMetrics.set(previousKey, prometheusMetrics);
      this.previousMetrics.set(`${previousKey}_timestamp`, collectTimestamp);
      
      // 6. Parse and store all metrics
      const allMetrics = [];
      
      // Health metrics
      allMetrics.push({
        metric_type: 'health',
        metric_name: 'vector_health_status',
        metric_value: healthData.healthy ? 1.0 : 0.0,
        unit: 'boolean'
      });
      
      // Container metrics
      if (statsData.stats !== 'unavailable' && statsData.stats !== 'no container') {
        allMetrics.push({
          metric_type: 'status',
          metric_name: 'container_running',
          metric_value: 1.0,
          unit: 'boolean'
        });
        
        // Parse container stats for detailed metrics
        const statsMetrics = this.parseContainerStats(statsData.stats);
        allMetrics.push(...statsMetrics);
      }
      
      // Prometheus metrics
      Object.entries(prometheusMetrics).forEach(([key, value]) => {
        const metricInfo = this.categorizePrometheusMetric(key, value);
        if (metricInfo) {
          allMetrics.push(metricInfo);
        }
      });
      
      // Rate metrics
      Object.entries(rates).forEach(([key, value]) => {
        allMetrics.push({
          metric_type: 'throughput',
          metric_name: key,
          metric_value: value,
          unit: key.includes('events') ? 'events/sec' : 'bytes/sec'
        });
      });
      
      // GraphQL component metrics
      if (graphqlMetrics.components) {
        const componentMetrics = this.parseGraphQLComponents(graphqlMetrics.components);
        allMetrics.push(...componentMetrics);
      }
      
      // 7. Store to database (pipeline_metrics table can be reused)
      let storedCount = 0;
      for (const metric of allMetrics) {
        try {
          await client.query(
            `INSERT INTO pipeline_metrics (pipeline_id, metric_type, metric_name, metric_value, unit, collected_at) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [pipelineId, metric.metric_type, metric.metric_name, metric.metric_value, metric.unit, collectTimestamp]
          );
          storedCount++;
        } catch (error) {
          console.error(`Error storing metric ${metric.metric_name}:`, error.message);
        }
      }
      
      console.log(`✅ [Custom Monitor] Stored ${storedCount}/${allMetrics.length} metrics for custom pipeline ${pipeline.name}`);
      
      return {
        success: true,
        pipeline_id: pipelineId,
        pipeline_name: pipeline.name,
        pipeline_status: pipeline.status,
        metrics_collected: storedCount,
        health_data: healthData,
        stats_data: statsData,
        prometheus_metrics_count: Object.keys(prometheusMetrics).length,
        graphql_components_count: graphqlMetrics.components ? graphqlMetrics.components.length : 0,
        rates_calculated: Object.keys(rates).length,
        timestamp: collectTimestamp
      };
      
    } catch (error) {
      console.error('Error in collectCustomPipelineMetrics:', error);
      return {
        success: false,
        pipeline_id: pipelineId,
        error: error.message,
        timestamp: collectTimestamp
      };
    } finally {
      client.release();
    }
  }

  /**
   * Collect metrics for all active custom pipelines
   */
  async collectAllCustomPipelineMetrics() {
    try {
      const client = await db.connect();
      
      try {
        const result = await client.query(
          'SELECT id, name FROM custom_pipelines WHERE deleted = false AND status = $1',
          ['running']
        );
        
        const pipelines = result.rows;
        console.log(`🔄 [Custom Monitor] Found ${pipelines.length} running custom pipelines to monitor`);
        
        if (pipelines.length === 0) {
          return {
            success: true,
            pipelines_count: 0,
            message: 'No running custom pipelines found',
            metrics_collected: 0
          };
        }
        
        let totalMetricsCollected = 0;
        const results = [];
        
        // Collect metrics for each pipeline
        for (const pipeline of pipelines) {
          try {
            console.log(`📊 [Custom Monitor] Collecting metrics for: ${pipeline.name} (${pipeline.id})`);
            
            const result = await this.collectCustomPipelineMetrics(pipeline.id);
            results.push({
              pipeline_id: pipeline.id,
              pipeline_name: pipeline.name,
              success: result.success,
              metrics_collected: result.metrics_collected || 0
            });
            
            if (result.success) {
              totalMetricsCollected += result.metrics_collected;
            }
            
          } catch (error) {
            console.error(`Error collecting metrics for custom pipeline ${pipeline.name}:`, error);
            results.push({
              pipeline_id: pipeline.id,
              pipeline_name: pipeline.name,
              success: false,
              error: error.message
            });
          }
        }
        
        return {
          success: true,
          pipelines_count: pipelines.length,
          metrics_collected: totalMetricsCollected,
          results: results
        };
        
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('Error in collectAllCustomPipelineMetrics:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  /**
   * Get custom pipeline metrics history
   */
  async getCustomPipelineMetrics(pipelineId, timeRange = '1 hour', metricTypes = null, startTime = null, endTime = null, limit = 100) {
    const client = await db.connect();
    
    try {
      // Verify pipeline exists
      const pipelineResult = await client.query(
        'SELECT id, name FROM custom_pipelines WHERE id = $1 AND deleted = false',
        [pipelineId]
      );
      
      if (pipelineResult.rows.length === 0) {
        return {
          success: false,
          message: 'Custom pipeline not found'
        };
      }      const timeCondition = this.getTimeCondition(timeRange);
      
      let query = `
        SELECT 
          metric_type,
          metric_name,
          metric_value,
          unit,
          collected_at
        FROM pipeline_metrics 
        WHERE pipeline_id = $1 
      `;
      
      const params = [pipelineId];
      let paramCounter = 1;
      
      // Add time conditions
      if (startTime && endTime) {
        query += ` AND collected_at BETWEEN $${++paramCounter} AND $${++paramCounter}`;
        params.push(startTime, endTime);
      } else {
        query += ` AND collected_at >= NOW() - INTERVAL '${timeCondition}'`;
      }
      
      // Add metric type filter
      if (metricTypes && metricTypes.length > 0) {
        query += ` AND metric_type = ANY($${++paramCounter})`;
        params.push(metricTypes);
      }
      
      query += ` ORDER BY collected_at DESC`;
      
      // Add limit
      if (limit && limit > 0) {
        query += ` LIMIT $${++paramCounter}`;
        params.push(limit);
      }
      
      const result = await client.query(query, params);
      
      // Group metrics by type
      const groupedMetrics = {};
      result.rows.forEach(row => {
        if (!groupedMetrics[row.metric_type]) {
          groupedMetrics[row.metric_type] = [];
        }
        groupedMetrics[row.metric_type].push(row);
      });
      
      // Calculate summaries
      const summary = {};
      Object.keys(groupedMetrics).forEach(type => {
        const typeMetrics = groupedMetrics[type];
        summary[type] = {
          count: typeMetrics.length,
          latest: typeMetrics[0],
          metrics: typeMetrics.reduce((acc, metric) => {
            if (!acc[metric.metric_name]) acc[metric.metric_name] = [];
            acc[metric.metric_name].push({
              value: metric.metric_value,
              unit: metric.unit,
              timestamp: metric.collected_at
            });
            return acc;
          }, {})
        };
      });
      
      return {
        success: true,
        pipeline_id: pipelineId,
        pipeline_name: pipelineResult.rows[0].name,
        time_range: timeRange,
        total_metrics: result.rows.length,
        metrics_by_type: groupedMetrics,
        summary: summary,
        latest_collection: result.rows[0]?.collected_at
      };
      
    } catch (error) {
      console.error('Error getting custom pipeline metrics:', error);
      return {
        success: false,
        pipeline_id: pipelineId,
        error: error.message
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get metrics dashboard for a custom pipeline
   */
  async getCustomPipelineDashboard(pipelineId) {
    const client = await db.connect();
    
    try {
      // Get pipeline details
      const pipelineResult = await client.query(
        'SELECT * FROM custom_pipelines WHERE id = $1 AND deleted = false', 
        [pipelineId]
      );
      
      if (pipelineResult.rows.length === 0) {
        return {
          success: false,
          message: 'Custom pipeline not found'
        };
      }
      
      const pipeline = pipelineResult.rows[0];
      
      // Get latest metrics
      const latestMetricsResult = await client.query(
        `SELECT 
          metric_type, 
          metric_name, 
          metric_value, 
          unit, 
          collected_at
        FROM pipeline_metrics
        WHERE pipeline_id = $1
        AND collected_at > NOW() - INTERVAL '15 minutes'
        ORDER BY collected_at DESC`,
        [pipelineId]
      );
      
      // Get throughput metrics over time
      const throughputResult = await client.query(
        `SELECT 
          metric_name, 
          metric_value, 
          collected_at
        FROM pipeline_metrics
        WHERE pipeline_id = $1
        AND metric_type = 'throughput'
        AND collected_at > NOW() - INTERVAL '1 hour'
        ORDER BY collected_at ASC`,
        [pipelineId]
      );
      
      // Get health metrics over time
      const healthResult = await client.query(
        `SELECT 
          metric_name, 
          metric_value, 
          collected_at
        FROM pipeline_metrics
        WHERE pipeline_id = $1
        AND metric_type = 'health'
        AND collected_at > NOW() - INTERVAL '1 hour'
        ORDER BY collected_at ASC`,
        [pipelineId]
      );
      
      // Process metrics for easier visualization
      const throughputSeries = {};
      throughputResult.rows.forEach(row => {
        if (!throughputSeries[row.metric_name]) {
          throughputSeries[row.metric_name] = [];
        }
        throughputSeries[row.metric_name].push({
          value: row.metric_value,
          timestamp: row.collected_at
        });
      });
      
      const healthSeries = healthResult.rows.map(row => ({
        status: row.metric_value > 0 ? 'healthy' : 'unhealthy',
        timestamp: row.collected_at
      }));
      
      // Group latest metrics by type
      const latestMetricsByType = {};
      latestMetricsResult.rows.forEach(row => {
        if (!latestMetricsByType[row.metric_type]) {
          latestMetricsByType[row.metric_type] = [];
        }
        latestMetricsByType[row.metric_type].push(row);
      });
      
      return {
        success: true,
        pipeline: pipeline,
        latest_metrics: latestMetricsByType,
        throughput_series: throughputSeries,
        health_series: healthSeries,
        latest_collection: latestMetricsResult.rows[0]?.collected_at,
        metrics_count: latestMetricsResult.rows.length
      };
      
    } catch (error) {
      console.error('Error getting custom pipeline dashboard:', error);
      return {
        success: false,
        error: error.message
      };
    } finally {
      client.release();
    }
  }

  /**
   * Parse container stats into metrics
   */
  parseContainerStats(statsLine) {
    const metrics = [];
    
    try {
      // Format: "0.23%     153MiB / 7.616GiB   19.7kB / 9.92kB   0B / 0B"
      // Split by multiple spaces to handle varying spacing
      const parts = statsLine.trim().split(/\s+/);
      console.log('🔍 [Container Stats] Raw line:', statsLine);
      console.log('🔍 [Container Stats] Parsed parts:', parts);
      
      if (parts.length >= 4) {
        // CPU Usage - parts[0]
        const cpuMatch = parts[0].match(/([0-9.]+)%/);
        if (cpuMatch) {
          const cpuValue = parseFloat(cpuMatch[1]);
          metrics.push({
            metric_type: 'resource',
            metric_name: 'cpu_usage_percent',
            metric_value: cpuValue,
            unit: 'percent'
          });
          console.log('✅ [Container Stats] CPU:', cpuValue + '%');
        }
        
        // Memory Usage - parts[1] format: "153MiB" and parts[3] format: "7.616GiB"
        const memUsedMatch = parts[1].match(/([0-9.]+[KMGT]?iB)/);
        if (memUsedMatch) {
          const memUsedBytes = this.parseSize(memUsedMatch[1]);
          metrics.push({
            metric_type: 'resource',
            metric_name: 'memory_usage',
            metric_value: memUsedBytes,
            unit: 'bytes'
          });
          console.log('✅ [Container Stats] Memory used:', memUsedBytes, 'bytes');
          
          // Calculate memory percentage if limit is available
          if (parts.length > 3) {
            const memLimitMatch = parts[3].match(/([0-9.]+[KMGT]?iB)/);
            if (memLimitMatch) {
              const memLimitBytes = this.parseSize(memLimitMatch[1]);
              const memPercent = (memUsedBytes / memLimitBytes) * 100;
              metrics.push({
                metric_type: 'resource',
                metric_name: 'memory_usage_percent',
                metric_value: memPercent,
                unit: 'percent'
              });
              console.log('✅ [Container Stats] Memory percent:', memPercent.toFixed(2) + '%');
            }
          }
        }
        
        // Network I/O - Find pattern like "19.7kB / 9.92kB"
        const networkPart = parts.find(part => part.includes('/') && (part.includes('B') || part.includes('iB')));
        if (networkPart) {
          const netMatch = networkPart.match(/([0-9.]+[KMGT]?B)\s*\/\s*([0-9.]+[KMGT]?B)/);
          if (netMatch) {
            const networkRx = this.parseSize(netMatch[1]);
            const networkTx = this.parseSize(netMatch[2]);
            
            metrics.push({
              metric_type: 'resource',
              metric_name: 'network_rx',
              metric_value: networkRx,
              unit: 'bytes'
            });
            metrics.push({
              metric_type: 'resource',
              metric_name: 'network_tx',
              metric_value: networkTx,
              unit: 'bytes'
            });
            console.log('✅ [Container Stats] Network RX:', networkRx, 'TX:', networkTx, 'bytes');
          }
        }
        
        // Block I/O - Usually the last part "0B / 0B"
        const blockPart = parts[parts.length - 1];
        if (blockPart && blockPart.includes('/')) {
          const blockMatch = blockPart.match(/([0-9.]+[KMGT]?B)\s*\/\s*([0-9.]+[KMGT]?B)/);
          if (blockMatch) {
            const blockRead = this.parseSize(blockMatch[1]);
            const blockWrite = this.parseSize(blockMatch[2]);
            
            metrics.push({
              metric_type: 'resource',
              metric_name: 'block_read',
              metric_value: blockRead,
              unit: 'bytes'
            });
            metrics.push({
              metric_type: 'resource',
              metric_name: 'block_write',
              metric_value: blockWrite,
              unit: 'bytes'
            });
            console.log('✅ [Container Stats] Block Read:', blockRead, 'Write:', blockWrite, 'bytes');
          }
        }
      }
      
      console.log(`✅ [Container Stats] Parsed ${metrics.length} metrics from stats`);
    } catch (error) {
      console.error('❌ [Container Stats] Error parsing:', error);
    }
    
    return metrics;
  }

  /**
   * Categorize Prometheus metrics
   */
  categorizePrometheusMetric(key, value) {
    if (key.includes('events_in_total') || key.includes('events_out_total')) {
      return {
        metric_type: 'throughput',
        metric_name: key,
        metric_value: value,
        unit: 'events'
      };
    }
    
    if (key.includes('bytes_in_total') || key.includes('bytes_out_total')) {
      return {
        metric_type: 'throughput',
        metric_name: key,
        metric_value: value,
        unit: 'bytes'
      };
    }
    
    if (key.includes('errors_total')) {
      return {
        metric_type: 'error',
        metric_name: key,
        metric_value: value,
        unit: 'count'
      };
    }
    
    if (key.includes('buffer_events') || key.includes('buffer_byte_size')) {
      return {
        metric_type: 'buffer',
        metric_name: key,
        metric_value: value,
        unit: key.includes('events') ? 'events' : 'bytes'
      };
    }
    
    return {
      metric_type: 'other',
      metric_name: key,
      metric_value: value,
      unit: 'count'
    };
  }

  /**
   * Parse GraphQL component metrics
   */
  parseGraphQLComponents(components) {
    const metrics = [];
    
    components.forEach(component => {
      // Source metrics
      if (component.sources) {
        component.sources.forEach(source => {
          if (source.receivedEventsTotal !== undefined) {
            metrics.push({
              metric_type: 'component',
              metric_name: `${component.componentId}_received_events_total`,
              metric_value: source.receivedEventsTotal,
              unit: 'events'
            });
          }
          if (source.receivedBytesTotal !== undefined) {
            metrics.push({
              metric_type: 'component',
              metric_name: `${component.componentId}_received_bytes_total`,
              metric_value: source.receivedBytesTotal,
              unit: 'bytes'
            });
          }
        });
      }
      
      // Sink metrics
      if (component.sinks) {
        component.sinks.forEach(sink => {
          if (sink.receivedEventsTotal !== undefined) {
            metrics.push({
              metric_type: 'component',
              metric_name: `${component.componentId}_sink_received_events_total`,
              metric_value: sink.receivedEventsTotal,
              unit: 'events'
            });
          }
          if (sink.errorEventsTotal !== undefined) {
            metrics.push({
              metric_type: 'error',
              metric_name: `${component.componentId}_sink_error_events_total`,
              metric_value: sink.errorEventsTotal,
              unit: 'events'
            });
          }
        });
      }
    });
    
    return metrics;
  }

  /**
   * Helper: Convert time range to SQL interval
   */
  getTimeCondition(timeRange) {
    const ranges = {
      '5m': '5 minutes',
      '15m': '15 minutes',
      '30m': '30 minutes',
      '1h': '1 hour',
      '1 hour': '1 hour',
      '6h': '6 hours',
      '12h': '12 hours',
      '24h': '24 hours',
      '1d': '1 day',
      '7d': '7 days'
    };
    
    return ranges[timeRange] || '1 hour';
  }

  /**
   * Delete all metrics for a custom pipeline
   */
  async deleteCustomPipelineMetrics(pipelineId) {
    const client = await db.connect();
    
    try {
      // Verify pipeline exists
      const pipelineResult = await client.query(
        'SELECT id, name FROM custom_pipelines WHERE id = $1 AND deleted = false',
        [pipelineId]
      );
      
      if (pipelineResult.rows.length === 0) {
        return {
          success: false,
          message: 'Custom pipeline not found'
        };
      }

      const pipeline = pipelineResult.rows[0];
      
      // First, count how many will be deleted
      const countResult = await client.query(
        'SELECT COUNT(*) FROM pipeline_metrics WHERE pipeline_id = $1',
        [pipelineId]
      );
      const metricsToDelete = parseInt(countResult.rows[0].count);
      
      // Execute delete all metrics for this pipeline
      const deleteResult = await client.query(
        'DELETE FROM pipeline_metrics WHERE pipeline_id = $1',
        [pipelineId]
      );
      const deletedCount = deleteResult.rowCount;
      
      console.log(`🗑️ [Custom Monitor] Deleted ${deletedCount} metrics for pipeline ${pipeline.name}`);
      
      return {
        success: true,
        pipeline_id: pipelineId,
        pipeline_name: pipeline.name,
        metrics_deleted: deletedCount,
        message: `Deleted all ${deletedCount} metrics from database`,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error deleting custom pipeline metrics:', error);
      return {
        success: false,
        pipeline_id: pipelineId,
        error: error.message
      };
    } finally {
      client.release();
    }
  }

  /**
   * Helper: Parse size string to bytes
   */
  parseSize(sizeStr) {
    const match = sizeStr.match(/([0-9.]+)([KMGT]?)iB/);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2];
    
    const multipliers = {
      '': 1,
      'K': 1024,
      'M': 1024 * 1024,
      'G': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024
    };
    
    return value * (multipliers[unit] || 1);  }
}

// Export default instance
export const customMonitorService = new CustomMonitorService();

// Export class for direct usage
export { CustomVectorMetricsCollector };
