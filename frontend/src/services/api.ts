import axios from 'axios';
import { 
  Pipeline, 
  ApiResponse, 
  CreatePipelineForm, 
  MetricsData, 
  DashboardData, 
  SchedulerStatus,
  SystemOverview 
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    console.log(`API Response: ${response.status}`, response.data);
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Pipeline Management API
export const pipelineApi = {  // Create pipeline
  create: async (data: CreatePipelineForm): Promise<Pipeline> => {
    // Transform data to match Custom Pipeline API format
    const sources: Record<string, any> = {};
    const transforms: Record<string, string[]> = {};
    const sinks: Record<string, any[]> = {};
    
    // Transform sources
    for (const [sourceId, sourceConfigData] of Object.entries(data.sources)) {
      const sourceConfig = sourceConfigData.source;
      
      switch (sourceConfig.type) {
        case 'file':
          sources[sourceId] = {
            type: 'file',
            include: sourceConfig.patterns || [], // Map patterns to include
          };
          break;
        case 'http':
          sources[sourceId] = {
            type: 'http',
            listen_port: sourceConfig.listen_port || 8088,
          };
          break;
        case 'prometheus_scrape':
          sources[sourceId] = {
            type: 'prometheus_scrape',
            endpoints: sourceConfig.endpoints || [],
            scrape_interval_secs: sourceConfig.scrape_interval || 15,
          };
          break;
        case 'docker_logs':
          sources[sourceId] = {
            type: 'docker_logs',
            include_containers: sourceConfig.include_containers || [],
            exclude_containers: sourceConfig.exclude_containers || [],
          };
          break;
        case 'syslog':
          sources[sourceId] = {
            type: 'syslog',
            mode: sourceConfig.mode || 'tcp',
            address: sourceConfig.address || '0.0.0.0:5514',
          };
          break;
        default:
          throw new Error(`Unsupported source type: ${sourceConfig.type}`);
      }
      
      // Set transforms and sinks for this source
      transforms[sourceId] = sourceConfigData.transforms || [];
      sinks[sourceId] = sourceConfigData.sinks || []; // Keep full sink objects with config
    }
    
    const transformedData = {
      name: data.name,
      description: data.description,
      sources,
      transforms,
      sinks
    };
    
    console.log('Sending transformed data to custom-pipelines:', transformedData);
    
    try {      const response = await api.post<any>('/custom-pipelines', transformedData);      console.log('API Create Response:', response.data);
      
      // Handle Custom Pipeline API response structure  
      let pipeline;
      if (response.data.pipeline) {
        pipeline = response.data.pipeline;
      } else if (response.data.data) {
        pipeline = response.data.data;
      } else {
        throw new Error('No pipeline data in response');
      }
      
      // Custom pipeline API returns standard format, convert to expected format
      const formattedPipeline = {
        id: pipeline.id,
        name: pipeline.name || transformedData.name,
        status: pipeline.status || 'created',
        container_id: pipeline.container_id,
        created_at: pipeline.created_at || new Date().toISOString(),
        sources_config: pipeline.sources_config,
        transforms_config: pipeline.transforms_config,
        sinks_config: pipeline.sinks_config,
        exposed_ports: pipeline.exposed_ports || [],
        ...pipeline
      };
      
      return formattedPipeline;
    } catch (error: any) {
      console.error('Pipeline creation failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message || 'Failed to create pipeline');
    }
  },  // List all pipelines
  list: async (): Promise<Pipeline[]> => {
    try {
      const response = await api.get<any>('/custom-pipelines');
      console.log('API List Response:', response.data);
      
      // Handle Custom Pipeline API response structure
      let pipelines;
      if (response.data.pipelines) {
        pipelines = response.data.pipelines;
      } else if (response.data.data) {
        pipelines = response.data.data;
      } else if (Array.isArray(response.data)) {
        pipelines = response.data;
      } else {
        pipelines = [];
      }
      
      return Array.isArray(pipelines) ? pipelines : [];
    } catch (error: any) {
      console.error('Failed to fetch pipelines:', error.response?.data || error.message);
      return [];
    }
  },

  // Get pipeline by ID
  getById: async (id: string): Promise<Pipeline> => {
    try {
      const response = await api.get<any>(`/custom-pipelines/${id}`);
      console.log('API GetById Response:', response.data);
      
      // Handle different response structures
      let pipeline;
      if (response.data.pipeline) {
        pipeline = response.data.pipeline;
      } else if (response.data.data) {
        pipeline = response.data.data;
      } else if (response.data.id) {
        pipeline = response.data;
      } else {
        throw new Error('Pipeline not found in response');
      }
      
      return pipeline;
    } catch (error: any) {
      console.error('Failed to fetch pipeline:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message || 'Failed to fetch pipeline');
    }
  },

  // Delete pipeline
  delete: async (id: string): Promise<void> => {
    await api.delete(`/custom-pipelines/${id}`);
  },

  // Validate pipeline name
  validateName: async (name: string): Promise<boolean> => {
    try {
      const pipelines = await pipelineApi.list();
      return !pipelines.some(p => p.name === name && !p.deleted);
    } catch (error) {
      console.error('Error validating pipeline name:', error);
      return false;
    }
  },

  // Check port availability
  checkPortAvailability: async (port: number): Promise<boolean> => {
    try {
      const pipelines = await pipelineApi.list();
      const usedPorts = pipelines
        .filter(p => p.status === 'running')
        .flatMap(p => p.exposed_ports);
      return !usedPorts.includes(port);
    } catch (error) {
      console.error('Error checking port availability:', error);
      return false;
    }
  }
};

// Management API
export const managementApi = {
  // Stop pipeline
  stop: async (id: string): Promise<Pipeline> => {
    const response = await api.post<ApiResponse<Pipeline>>(`/manage/stop/${id}`);
    return response.data.pipeline!;
  },

  // Restart pipeline
  restart: async (id: string): Promise<Pipeline> => {
    const response = await api.post<ApiResponse<Pipeline>>(`/manage/restart/${id}`);
    return response.data.pipeline!;
  },

  // Delete pipeline
  delete: async (id: string): Promise<void> => {
    await api.delete(`/manage/delete/${id}`);
  },

  // Get pipeline status
  getStatus: async (id: string): Promise<Pipeline> => {
    const response = await api.get<ApiResponse<Pipeline>>(`/manage/status/${id}`);
    return response.data.pipeline!;
  },

  // Get all pipelines
  getAll: async (): Promise<Pipeline[]> => {
    const response = await api.get<ApiResponse<Pipeline[]>>('/manage/all');
    return response.data.pipelines || [];
  }
};

// Monitoring API
export const monitoringApi = {
  // Collect metrics for specific pipeline
  collectMetrics: async (id: string): Promise<any> => {
    const response = await api.post(`/custom-monitoring/collect/${id}`);
    return response.data;
  },

  // Collect metrics for all pipelines
  collectAllMetrics: async (): Promise<any> => {
    const response = await api.post('/custom-monitoring/collect-all');
    return response.data;
  },  // Get historical metrics
  getMetrics: async (
    id: string, 
    timeRange: string = '1h',
    category?: string,
    startTime?: string,
    endTime?: string,
    limit: number = 100
  ): Promise<MetricsData[]> => {
    const params = new URLSearchParams({
      timeRange,
      limit: limit.toString()
    });
    if (category) params.append('category', category);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);

    const response = await api.get(`/custom-monitoring/metrics/${id}?${params}`);
    console.log('Monitoring Metrics Response:', response.data);
    
    // Handle custom monitoring API response structure
    if (response.data.status === 'success' && response.data.metrics_by_type) {
      // Convert the metrics_by_type structure to MetricsData[]
      const metricsArray: MetricsData[] = [];
      for (const [type, metrics] of Object.entries(response.data.metrics_by_type)) {
        if (Array.isArray(metrics)) {
          metrics.forEach((metric: any, index: number) => {
            metricsArray.push({
              id: `${id}_${type}_${index}`,
              pipeline_id: id,
              metric_type: type as 'prometheus' | 'graphql' | 'container_stats' | 'health',
              data: {
                name: metric.metric_name,
                value: parseFloat(metric.metric_value),
                unit: metric.unit
              },
              collected_at: metric.collected_at
            });
          });
        }
      }
      return metricsArray;
    } else {
      return [];
    }
  },

  // Get dashboard data
  getDashboard: async (id: string, timeRange: string = '1h'): Promise<DashboardData> => {
    const response = await api.get(`/custom-monitoring/dashboard/${id}?timeRange=${timeRange}`);
    console.log('Monitoring Dashboard Response:', response.data);
    
    // Handle custom monitoring API response structure
    if (response.data.status === 'success' && response.data.pipeline) {
      const pipeline = response.data.pipeline;
      const latestMetrics = response.data.latest_metrics || {};
      
      // Extract metrics values
      let events_in_rate = 0;
      let events_in_total = 0;
      let cpu_usage_percent = 0;
      let memory_usage_mb = 0;
      let errors_total = 0;
      
      // Parse metrics from the response
      if (latestMetrics.performance) {
        latestMetrics.performance.forEach((metric: any) => {
          if (metric.metric_name.includes('throughput')) {
            events_in_rate = parseFloat(metric.metric_value) || 0;
          }
        });
      }
      
      if (latestMetrics.system) {
        latestMetrics.system.forEach((metric: any) => {
          if (metric.metric_name.includes('cpu')) {
            cpu_usage_percent = parseFloat(metric.metric_value) || 0;
          } else if (metric.metric_name.includes('memory')) {
            memory_usage_mb = parseFloat(metric.metric_value) || 0;
          }
        });
      }
      
      // Determine health status
      let healthStatus: 'healthy' | 'unhealthy' = 'healthy';
      let healthMessage = 'Pipeline is running normally';
      
      if (latestMetrics.health) {
        const healthMetric = latestMetrics.health.find((m: any) => m.metric_name === 'vector_health_status');
        if (healthMetric && parseFloat(healthMetric.metric_value) < 1) {
          healthStatus = 'unhealthy';
          healthMessage = 'Pipeline health check failed';
        }
      }
      
      // Transform to DashboardData format
      return {
        pipelineId: pipeline.id,
        currentMetrics: {
          events_in_rate,
          events_in_total,
          cpu_usage_percent,
          memory_usage_mb,
          errors_total
        },
        healthCheck: {
          status: healthStatus,
          message: healthMessage,
          last_check: response.data.latest_collection
        },
        timeRange: timeRange
      };
    } else {
      throw new Error('Invalid response structure from dashboard API');
    }
  },  // Get system overview
  getOverview: async (timeRange: string = '1h'): Promise<SystemOverview> => {
    const response = await api.get(`/custom-monitoring/overview?timeRange=${timeRange}`);
    console.log('Monitoring Overview Response:', response.data);
    
    // Handle the response structure from custom monitoring API
    if (response.data.status === 'success' && response.data.overview) {
      return {
        ...response.data.overview,
        pipelines: response.data.pipelines || []
      };
    } else {
      throw new Error('Invalid response structure from monitoring API');
    }
  },

  // Check pipeline health
  checkHealth: async (id: string): Promise<any> => {
    const response = await api.get(`/custom-monitoring/health/${id}`);
    return response.data.healthCheck;
  },

  // Get metrics categories
  getCategories: async (): Promise<string[]> => {
    const response = await api.get('/custom-monitoring/metrics-categories');
    return response.data.categories;
  }
};

// Scheduler API
export const schedulerApi = {
  // Start scheduler
  start: async (intervalSeconds: number = 30): Promise<SchedulerStatus> => {
    const response = await api.post('/scheduler/start', { interval_seconds: intervalSeconds });
    return response.data.data;
  },

  // Stop scheduler
  stop: async (): Promise<SchedulerStatus> => {
    const response = await api.post('/scheduler/stop');
    return response.data.data;
  },

  // Update interval
  updateInterval: async (intervalSeconds: number): Promise<void> => {
    await api.put('/scheduler/interval', { interval_seconds: intervalSeconds });
  },

  // Get status
  getStatus: async (): Promise<SchedulerStatus> => {
    const response = await api.get('/scheduler/status');
    return response.data.data.scheduler;
  }
};

// Metrics API
export const metricsApi = {
  // Manual metrics collection for specific pipeline
  collect: async (pipelineId: string): Promise<any> => {
    const response = await api.post(`/custom-monitoring/collect/${pipelineId}`);
    return response.data;
  },

  // Automatic metrics collection for all pipelines
  collectAll: async (): Promise<any> => {
    const response = await api.post('/custom-monitoring/collect-all');
    return response.data;
  },

  // Get metrics with time range
  getMetrics: async (
    pipelineId: string, 
    timeRange: string = '1h',
    category?: string,
    startTime?: string,
    endTime?: string,
    limit: number = 100
  ): Promise<any> => {
    const params = new URLSearchParams({
      timeRange,
      limit: limit.toString(),
    });
    
    if (category) params.append('category', category);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);

    const response = await api.get(`/custom-monitoring/metrics/${pipelineId}?${params}`);
    return response.data;
  },

  // Get dashboard data for pipeline
  getDashboard: async (pipelineId: string, timeRange: string = '1h'): Promise<any> => {
    const response = await api.get(`/custom-monitoring/dashboard/${pipelineId}?timeRange=${timeRange}`);
    return response.data;
  },

  // Get pipeline health status
  getHealth: async (pipelineId: string): Promise<any> => {
    const response = await api.get(`/custom-monitoring/health/${pipelineId}`);
    return response.data;
  },

  // Get available metrics categories
  getCategories: async (): Promise<any> => {
    const response = await api.get('/custom-monitoring/metrics-categories');
    return response.data;
  },

  // Delete all metrics for a pipeline
  deleteMetrics: async (pipelineId: string): Promise<any> => {
    const response = await api.delete(`/custom-monitoring/metrics/${pipelineId}`);
    return response.data;
  }
};

// AWS Validation API (custom endpoints we'll need to add)
export const validationApi = {
  // Test AWS credentials
  testAwsCredentials: async (accessKey: string, secretKey: string, region: string): Promise<boolean> => {
    try {
      // This would require a backend endpoint to test AWS credentials
      // For now, we'll just do basic validation
      return accessKey.length > 0 && secretKey.length > 0 && region.length > 0;
    } catch (error) {
      console.error('Error testing AWS credentials:', error);
      return false;
    }
  },

  // Test S3 bucket access
  testS3Bucket: async (bucket: string, region: string, accessKey: string, secretKey: string): Promise<boolean> => {
    try {
      // This would require a backend endpoint to test S3 access
      // For now, we'll just do basic validation
      return bucket.length > 0;
    } catch (error) {
      console.error('Error testing S3 bucket:', error);
      return false;
    }
  }
};

export default api;
