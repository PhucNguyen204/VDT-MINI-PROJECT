// monitoring.service.advanced.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fetch from 'node-fetch';
import { db } from '../configs/db.js';

const execAsync = promisify(exec);

/**
 * Advanced Vector metrics collector with full metrics support
 */
class AdvancedVectorMetricsCollector {
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
   * Health check via REST API
   */
  async getHealthStatus(pipelineId) {
    try {
      const containerIP = await this.getContainerIP(pipelineId);
      const response = await fetch(`http://${containerIP}:${this.basePort}/health`, {
        timeout: 5000
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
      return {
        healthy: false,
        status: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get Prometheus metrics
   */
  async getPrometheusMetrics(pipelineId) {
    try {
      const containerIP = await this.getContainerIP(pipelineId);
      const response = await fetch(`http://${containerIP}:${this.basePort}/metrics`, {
        timeout: 10000
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
        timeout: 10000
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
   * Get container stats
   */
  async getContainerStats(pipelineId) {
    const containerName = `vector_${pipelineId}`;
    try {
      const { stdout } = await execAsync(
        `docker stats ${containerName} --no-stream --format "table {{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"`
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
   * Calculate throughput rates
   */
  calculateRates(currentMetrics, previousMetrics, timeDiff) {
    const rates = {};
    
    if (!previousMetrics || timeDiff <= 0) return rates;
    
    // Calculate events/sec rate
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
 * Advanced monitoring service with comprehensive metrics
 */
export class AdvancedMonitoringService {
  constructor() {
    this.collector = new AdvancedVectorMetricsCollector();
    this.previousMetrics = new Map(); // Store previous metrics for rate calculation
  }

  /**
   * Collect comprehensive metrics for a pipeline
   */
  async collectAdvancedMetrics(pipelineId) {
    const client = await db.connect();
    const collectTimestamp = new Date();
    
    try {
      console.log(`🔍 Collecting advanced metrics for pipeline: ${pipelineId}`);
      
      // 1. Get health status
      const healthData = await this.collector.getHealthStatus(pipelineId);
      
      // 2. Get container stats
      const statsData = await this.collector.getContainerStats(pipelineId);
      
      // 3. Get Prometheus metrics
      const prometheusMetrics = await this.collector.getPrometheusMetrics(pipelineId);
      
      // 4. Get GraphQL metrics
      const graphqlMetrics = await this.collector.getGraphQLMetrics(pipelineId);
      
      // 5. Calculate rates
      const previousKey = `${pipelineId}_previous`;
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
      if (statsData.stats !== 'unavailable') {
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
      
      // 7. Store to database
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
      
      console.log(`✅ Stored ${storedCount}/${allMetrics.length} metrics for pipeline ${pipelineId}`);
      
      return {
        success: true,
        pipeline_id: pipelineId,
        metrics_collected: storedCount,
        health_data: healthData,
        stats_data: statsData,
        prometheus_metrics_count: Object.keys(prometheusMetrics).length,
        graphql_components_count: graphqlMetrics.components ? graphqlMetrics.components.length : 0,
        rates_calculated: Object.keys(rates).length,
        timestamp: collectTimestamp
      };
      
    } catch (error) {
      console.error('Error in collectAdvancedMetrics:', error);
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
   * Parse container stats into metrics
   */
  parseContainerStats(statsLine) {
    const metrics = [];
    
    try {
      // Example: "0.04%	108.9MiB / 7.616GiB	17.3kB / 13.8kB	0B / 0B"
      const parts = statsLine.split('\t');
      
      if (parts.length >= 4) {
        // CPU percentage
        const cpuMatch = parts[0].match(/([0-9.]+)%/);
        if (cpuMatch) {
          metrics.push({
            metric_type: 'performance',
            metric_name: 'container_cpu_percent',
            metric_value: parseFloat(cpuMatch[1]),
            unit: 'percent'
          });
        }
        
        // Memory usage
        const memMatch = parts[1].match(/([0-9.]+)([KMGT]?)iB/);
        if (memMatch) {
          const value = parseFloat(memMatch[1]);
          const unit = memMatch[2] || '';
          const multiplier = { '': 1, 'K': 1024, 'M': 1024*1024, 'G': 1024*1024*1024, 'T': 1024*1024*1024*1024 };
          const bytes = value * (multiplier[unit] || 1);
          
          metrics.push({
            metric_type: 'performance',
            metric_name: 'container_memory_bytes',
            metric_value: bytes,
            unit: 'bytes'
          });
        }
        
        // Network I/O
        const netMatch = parts[2].match(/([0-9.]+)([KMGT]?)B\s*\/\s*([0-9.]+)([KMGT]?)B/);
        if (netMatch) {
          const inValue = parseFloat(netMatch[1]);
          const inUnit = netMatch[2] || '';
          const outValue = parseFloat(netMatch[3]);
          const outUnit = netMatch[4] || '';
          
          const multiplier = { '': 1, 'k': 1000, 'M': 1000000, 'G': 1000000000, 'T': 1000000000000 };
          
          metrics.push({
            metric_type: 'performance',
            metric_name: 'container_network_in_bytes',
            metric_value: inValue * (multiplier[inUnit] || 1),
            unit: 'bytes'
          });
          
          metrics.push({
            metric_type: 'performance',
            metric_name: 'container_network_out_bytes',
            metric_value: outValue * (multiplier[outUnit] || 1),
            unit: 'bytes'
          });
        }
      }
    } catch (error) {
      console.error('Error parsing container stats:', error);
    }
    
    return metrics;
  }

  /**
   * Categorize Prometheus metrics
   */
  categorizePrometheusMetric(key, value) {
    // Vector internal metrics
    if (key.includes('vector_')) {
      if (key.includes('events_total')) {
        return {
          metric_type: 'throughput',
          metric_name: key,
          metric_value: value,
          unit: 'count'
        };
      }
      
      if (key.includes('bytes_total')) {
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
      
      if (key.includes('buffer')) {
        return {
          metric_type: 'buffer',
          metric_name: key,
          metric_value: value,
          unit: 'count'
        };
      }
      
      if (key.includes('utilization')) {
        return {
          metric_type: 'buffer',
          metric_name: key,
          metric_value: value,
          unit: 'percent'
        };
      }
    }
    
    // Source metrics
    if (key.includes('source_')) {
      return {
        metric_type: 'source',
        metric_name: key,
        metric_value: value,
        unit: key.includes('events') ? 'count' : 'bytes'
      };
    }
    
    // Sink metrics
    if (key.includes('sink_')) {
      return {
        metric_type: 'sink',
        metric_name: key,
        metric_value: value,
        unit: key.includes('events') ? 'count' : 'bytes'
      };
    }
    
    return null; // Skip unknown metrics
  }

  /**
   * Parse GraphQL component metrics
   */
  parseGraphQLComponents(components) {
    const metrics = [];
    
    components.forEach(component => {
      const componentId = component.componentId;
      const componentType = component.componentType;
      
      // Source metrics
      if (component.sources) {
        component.sources.forEach(source => {
          if (source.receivedEventsTotal !== undefined) {
            metrics.push({
              metric_type: 'source',
              metric_name: `source_${componentId}_received_events_total`,
              metric_value: source.receivedEventsTotal,
              unit: 'count'
            });
          }
          
          if (source.receivedBytesTotal !== undefined) {
            metrics.push({
              metric_type: 'source',
              metric_name: `source_${componentId}_received_bytes_total`,
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
              metric_type: 'sink',
              metric_name: `sink_${componentId}_total_events`,
              metric_value: sink.receivedEventsTotal,
              unit: 'count'
            });
          }
          
          if (sink.receivedBytesTotal !== undefined) {
            metrics.push({
              metric_type: 'sink',
              metric_name: `sink_${componentId}_total_bytes`,
              metric_value: sink.receivedBytesTotal,
              unit: 'bytes'
            });
          }
          
          if (sink.errorEventsTotal !== undefined) {
            metrics.push({
              metric_type: 'error',
              metric_name: `sink_${componentId}_send_errors_total`,
              metric_value: sink.errorEventsTotal,
              unit: 'count'
            });
          }
        });
      }
      
      // Output metrics
      if (component.outputs) {
        component.outputs.forEach(output => {
          if (output.sentEventsTotal !== undefined) {
            metrics.push({
              metric_type: 'throughput',
              metric_name: `${componentType}_${componentId}_sent_events_total`,
              metric_value: output.sentEventsTotal,
              unit: 'count'
            });
          }
          
          if (output.sentBytesTotal !== undefined) {
            metrics.push({
              metric_type: 'throughput',
              metric_name: `${componentType}_${componentId}_sent_bytes_total`,
              metric_value: output.sentBytesTotal,
              unit: 'bytes'
            });
          }
        });
      }
    });
    
    return metrics;
  }

  /**
   * Get comprehensive metrics history
   */
  async getAdvancedMetricsHistory(pipelineId, timeRange = '1 hour') {
    const client = await db.connect();
    
    try {
      const timeCondition = this.getTimeCondition(timeRange);
      
      const query = `
        SELECT 
          metric_type,
          metric_name,
          metric_value,
          unit,
          collected_at
        FROM pipeline_metrics 
        WHERE pipeline_id = $1 
          AND collected_at >= NOW() - INTERVAL '${timeCondition}'
        ORDER BY collected_at DESC
      `;
      
      const result = await client.query(query, [pipelineId]);
      
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
        time_range: timeRange,
        total_metrics: result.rows.length,
        metrics_by_type: groupedMetrics,
        summary: summary,
        latest_collection: result.rows[0]?.collected_at
      };
      
    } catch (error) {
      console.error('Error getting advanced metrics history:', error);
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
   * Helper: Convert time range to SQL interval
   */
  getTimeCondition(timeRange) {
    const timeMap = {
      '15 minutes': '15 minutes',
      '1 hour': '1 hour',
      '6 hours': '6 hours',
      '24 hours': '24 hours',
      '7 days': '7 days'
    };
    
    return timeMap[timeRange] || '1 hour';
  }
}

export default AdvancedMonitoringService;
