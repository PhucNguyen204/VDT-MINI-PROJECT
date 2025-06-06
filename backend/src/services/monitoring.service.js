// monitoring.service.js
import { exec } from 'child_process';
import { promisify } from 'util';
import { db } from '../configs/db.js';

const execAsync = promisify(exec);

/**
 * Vector GraphQL API client để thu thập metrics
 */
class VectorMetricsCollector {
  constructor(apiEndpoint = 'http://localhost:8686/graphql') {
    this.apiEndpoint = apiEndpoint;
  }

  /**
   * Query Vector GraphQL API để lấy metrics
   */
  async queryVectorAPI(pipelineId, query) {
    try {
      const containerName = `vector_${pipelineId}`;
        // Tìm IP của container để connect tới Vector API
      const { stdout: containerIP } = await execAsync(
        `docker inspect ${containerName} --format="{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"`
      );
      
      const vectorAPI = `http://${containerIP.trim()}:8686/graphql`;
      
      const response = await fetch(vectorAPI, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Vector API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[Monitoring] Error querying Vector API for ${pipelineId}:`, error.message);
      throw error;
    }
  }
  /**
   * Lấy health metrics của pipeline components
   */
  async getHealthMetrics(pipelineId) {
    const query = `
      query {
        health
        components {
          edges {
            node {
              componentId
              componentType
              ... on Source {
                outputs {
                  ... on SourceOutput {
                    port
                  }
                }
              }
              ... on Transform {
                inputs {
                  port
                }
                outputs {
                  port
                }
              }
              ... on Sink {
                inputs {
                  port
                }
              }
            }
          }
        }
      }
    `;
    
    return await this.queryVectorAPI(pipelineId, query);
  }

  /**
   * Lấy throughput metrics
   */
  async getThroughputMetrics(pipelineId) {
    const query = `
      query {
        components {
          sources {
            componentId
            metrics {
              eventsInTotal {
                metric {
                  timestamp
                  value
                }
              }
              processedBytesTotal {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
          sinks {
            componentId
            metrics {
              eventsOutTotal {
                metric {
                  timestamp
                  value
                }
              }
              processedEventsTotal {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
        }
      }
    `;
    
    return await this.queryVectorAPI(pipelineId, query);
  }

  /**
   * Lấy error metrics
   */
  async getErrorMetrics(pipelineId) {
    const query = `
      query {
        components {
          sources {
            componentId
            metrics {
              errorsTotal {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
          transforms {
            componentId
            metrics {
              errorsTotal {
                metric {
                  timestamp
                  value
                }
              }
              processedEventsTotal {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
          sinks {
            componentId
            metrics {
              errorsTotal {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
        }
      }
    `;
    
    return await this.queryVectorAPI(pipelineId, query);
  }

  /**
   * Lấy buffer/memory metrics
   */
  async getBufferMetrics(pipelineId) {
    const query = `
      query {
        components {
          sources {
            componentId
            metrics {
              bufferedEvents {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
          transforms {
            componentId
            metrics {
              bufferedEvents {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
          sinks {
            componentId
            metrics {
              bufferedEvents {
                metric {
                  timestamp
                  value
                }
              }
            }
          }
        }
      }
    `;
    
    return await this.queryVectorAPI(pipelineId, query);
  }
}

/**
 * Service class để thu thập và lưu trữ metrics
 */
export class MonitoringService {
  constructor() {
    this.collector = new VectorMetricsCollector();
  }

  /**
   * Thu thập tất cả metrics cho một pipeline
   */
  async collectPipelineMetrics(pipelineId) {
    const client = await db.connect();
    
    try {
      console.log(`[Monitoring] Collecting metrics for pipeline: ${pipelineId}`);
      
      // Thu thập các loại metrics
      const [healthData, throughputData, errorData, bufferData] = await Promise.allSettled([
        this.collector.getHealthMetrics(pipelineId),
        this.collector.getThroughputMetrics(pipelineId), 
        this.collector.getErrorMetrics(pipelineId),
        this.collector.getBufferMetrics(pipelineId)
      ]);

      const metrics = [];
      const now = new Date();

      // Process health metrics
      if (healthData.status === 'fulfilled' && healthData.value.data) {
        const health = healthData.value.data.health;
        metrics.push({
          pipeline_id: pipelineId,
          metric_type: 'health',
          metric_name: 'overall_status',
          metric_value: health.status === 'healthy' ? 1 : 0,
          unit: 'boolean',
          collected_at: now
        });
      }

      // Process throughput metrics
      if (throughputData.status === 'fulfilled' && throughputData.value.data) {
        const components = throughputData.value.data.components;
        
        // Sources throughput
        if (components.sources) {
          for (const source of components.sources) {
            if (source.metrics?.eventsInTotal?.metric) {
              metrics.push({
                pipeline_id: pipelineId,
                metric_type: 'throughput',
                metric_name: `${source.componentId}_events_in_total`,
                metric_value: source.metrics.eventsInTotal.metric.value,
                unit: 'count',
                collected_at: now
              });
            }
          }
        }

        // Sinks throughput
        if (components.sinks) {
          for (const sink of components.sinks) {
            if (sink.metrics?.eventsOutTotal?.metric) {
              metrics.push({
                pipeline_id: pipelineId,
                metric_type: 'throughput',
                metric_name: `${sink.componentId}_events_out_total`,
                metric_value: sink.metrics.eventsOutTotal.metric.value,
                unit: 'count',
                collected_at: now
              });
            }
          }
        }
      }

      // Process error metrics
      if (errorData.status === 'fulfilled' && errorData.value.data) {
        const components = errorData.value.data.components;
        
        ['sources', 'transforms', 'sinks'].forEach(componentType => {
          if (components[componentType]) {
            for (const component of components[componentType]) {
              if (component.metrics?.errorsTotal?.metric) {
                metrics.push({
                  pipeline_id: pipelineId,
                  metric_type: 'error',
                  metric_name: `${component.componentId}_errors_total`,
                  metric_value: component.metrics.errorsTotal.metric.value,
                  unit: 'count',
                  collected_at: now
                });
              }
            }
          }
        });
      }

      // Process buffer metrics
      if (bufferData.status === 'fulfilled' && bufferData.value.data) {
        const components = bufferData.value.data.components;
        
        ['sources', 'transforms', 'sinks'].forEach(componentType => {
          if (components[componentType]) {
            for (const component of components[componentType]) {
              if (component.metrics?.bufferedEvents?.metric) {
                metrics.push({
                  pipeline_id: pipelineId,
                  metric_type: 'buffer',
                  metric_name: `${component.componentId}_buffered_events`,
                  metric_value: component.metrics.bufferedEvents.metric.value,
                  unit: 'count',
                  collected_at: now
                });
              }
            }
          }
        });
      }

      // Lưu metrics vào database
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
        
        console.log(`[Monitoring] Saved ${metrics.length} metrics for pipeline ${pipelineId}`);
      }

      return {
        success: true,
        pipeline_id: pipelineId,
        metrics_collected: metrics.length,
        timestamp: now
      };

    } catch (error) {
      console.error(`[Monitoring] Error collecting metrics for ${pipelineId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Thu thập metrics cho tất cả pipeline đang chạy
   */
  async collectAllPipelineMetrics() {
    const client = await db.connect();
    
    try {
      // Lấy danh sách pipeline đang active
      const { rows: activePipelines } = await client.query(
        'SELECT id, name FROM pipelines WHERE active = true AND deleted = false'
      );

      console.log(`[Monitoring] Found ${activePipelines.length} active pipelines to monitor`);

      const results = [];
      
      for (const pipeline of activePipelines) {
        try {
          const result = await this.collectPipelineMetrics(pipeline.id);
          results.push(result);
        } catch (error) {
          console.error(`[Monitoring] Failed to collect metrics for ${pipeline.name}:`, error.message);
          results.push({
            success: false,
            pipeline_id: pipeline.id,
            error: error.message
          });
        }
      }

      return {
        success: true,
        total_pipelines: activePipelines.length,
        successful_collections: results.filter(r => r.success).length,
        failed_collections: results.filter(r => !r.success).length,
        results
      };

    } catch (error) {
      console.error('[Monitoring] Error in collectAllPipelineMetrics:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Lấy metrics gần đây của một pipeline
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
      console.error(`[Monitoring] Error getting metrics for ${pipelineId}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Lấy tổng quan metrics của tất cả pipeline
   */
  async getAllPipelinesOverview() {
    const client = await db.connect();
    
    try {
      const query = `
        WITH latest_metrics AS (
          SELECT 
            pipeline_id,
            metric_type,
            metric_name,
            metric_value,
            unit,
            collected_at,
            ROW_NUMBER() OVER (PARTITION BY pipeline_id, metric_type, metric_name ORDER BY collected_at DESC) as rn
          FROM pipeline_metrics
          WHERE collected_at >= NOW() - INTERVAL '1 hour'
        )
        SELECT 
          p.id,
          p.name,
          p.source_type,
          p.active,
          lm.metric_type,
          lm.metric_name,
          lm.metric_value,
          lm.unit,
          lm.collected_at
        FROM pipelines p
        LEFT JOIN latest_metrics lm ON p.id = lm.pipeline_id AND lm.rn = 1
        WHERE p.deleted = false
        ORDER BY p.name, lm.metric_type, lm.metric_name
      `;

      const { rows } = await client.query(query);
      
      // Group by pipeline
      const pipelineOverview = {};
      
      for (const row of rows) {
        if (!pipelineOverview[row.id]) {
          pipelineOverview[row.id] = {
            id: row.id,
            name: row.name,
            source_type: row.source_type,
            active: row.active,
            metrics: {}
          };
        }
        
        if (row.metric_type) {
          if (!pipelineOverview[row.id].metrics[row.metric_type]) {
            pipelineOverview[row.id].metrics[row.metric_type] = {};
          }
          
          pipelineOverview[row.id].metrics[row.metric_type][row.metric_name] = {
            value: row.metric_value,
            unit: row.unit,
            collected_at: row.collected_at
          };
        }
      }

      return {
        success: true,
        pipelines: Object.values(pipelineOverview)
      };

    } catch (error) {
      console.error('[Monitoring] Error getting all pipelines overview:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

// Singleton instance
export const monitoringService = new MonitoringService();