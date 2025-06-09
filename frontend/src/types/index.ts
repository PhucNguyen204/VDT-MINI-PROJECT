// Pipeline Types
export interface Pipeline {
  id: string;
  name: string;
  description?: string;
  sources_config: Record<string, SourceConfig>;
  transforms_config: Record<string, string[]>;
  sinks_config: Record<string, string[]>;
  container_id?: string;
  config_path?: string;
  exposed_ports: number[];
  status: 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  created_at: string;
  updated_at: string;
  started_at?: string;
  stopped_at?: string;
  error_message?: string;
  active: boolean;
  deleted: boolean;
}

// Source Configuration Types
export interface SourceConfig {
  type: 'file' | 'http' | 'prometheus_scrape';
  include?: string[];
  listen_port?: number;
  endpoints?: string[];
  scrape_interval_secs?: number;
  path?: string;
  auth?: AuthConfig;
}

export interface AuthConfig {
  enabled: boolean;
  type?: 'basic' | 'bearer';
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
  };
}

// Metrics Types
export interface MetricsData {
  id: string;
  pipeline_id: string;
  metric_type: 'prometheus' | 'graphql' | 'container_stats' | 'health';
  data: any;
  collected_at: string;
}

export interface DashboardData {
  pipelineId: string;
  currentMetrics: {
    events_in_rate?: number;
    events_in_total?: number;
    cpu_usage_percent?: number;
    memory_usage_mb?: number;
    errors_total?: number;
  };
  healthCheck: {
    status: 'healthy' | 'unhealthy';
    message?: string;
    last_check?: string;
  };
  timeRange: string;
}

// Scheduler Types
export interface SchedulerStatus {
  is_running: boolean;
  interval_seconds: number;
  last_collection?: string;
  next_collection?: string;
  stats: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastError?: string;
  };
}

// API Response Types
export interface ApiResponse<T = any> {
  status: 'success' | 'error' | 'created';
  message?: string;
  data?: T;
  error?: string;
  count?: number;
  pipeline?: Pipeline;
  pipelines?: Pipeline[];
}

// Form Types for Pipeline Creation
export interface CreatePipelineForm {
  name: string;
  description: string;
  tags: string[];
  sources: Record<string, SourceConfigData>;
  transforms: Record<string, string[]>;
  sinks: Record<string, SinkFormData[]>;
}

export interface SourceConfigData {
  source: SourceFormData;
  transforms: string[];
  sinks: SinkFormData[];
}

export interface SourceFormData {
  type: 'file' | 'http' | 'prometheus_scrape';
  // File source fields
  path?: string;
  patterns?: string[];
  ignoreOlder?: boolean;
  followSymlinks?: boolean;
  maxLineLength?: number;
  encoding?: string;
  
  // HTTP source fields  
  listen_port?: number;
  enableAuth?: boolean;
  enableRateLimit?: boolean;
  enableCors?: boolean;
  
  // Prometheus source fields
  endpoints?: string[];
  scrape_interval?: number;
  authType?: 'none' | 'basic' | 'bearer';
  metricsFilter?: string;
}

export interface SinkFormData {
  type: 's3' | 'console' | 'cloudwatch' | 'elasticsearch';
  config: {
    // S3 sink
    bucket?: string;
    region?: string;
    prefix?: string;
    compression?: string;
    format?: string;
    access_key_id?: string;
    secret_access_key?: string;
    
    // Console sink
    prettyPrint?: boolean;
    includeMetadata?: boolean;
    
    // CloudWatch sink
    logGroup?: string;
    streamName?: string;
    
    // Elasticsearch sink
    index?: string;
    indexType?: string;
  };
}

// Transform Configuration Types
export interface TransformConfig {
  parse?: {
    format: 'json' | 'csv' | 'regex' | 'grok';
    skipInvalid?: boolean;
    addErrors?: boolean;
  };
  enrich?: {
    addTimestamp?: boolean;
    addHostname?: boolean;
    addSourceInfo?: boolean;
    addGeoIP?: boolean;
  };
  filter?: {
    conditions: FilterCondition[];
  };
  reduce?: {
    aggregationType: 'count' | 'sum' | 'avg' | 'min' | 'max';
    timeWindow: number;
    samplingRate?: number;
  };
}

export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'regex' | 'greater_than' | 'less_than';
  value: string;
  action: 'include' | 'exclude';
}

// UI State Types
export interface ValidationErrors {
  [field: string]: string[];
}

export interface FormValidation {
  errors: ValidationErrors;
  warnings: ValidationErrors;
  isValid: boolean;
}

export interface DeploymentState {
  status: 'idle' | 'validating' | 'deploying' | 'success' | 'error';
  progress: number;
  logs: string[];
  error?: string;
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  active?: boolean;
}

// Overview Types
export interface SystemOverview {
  totalPipelines: number;
  healthyPipelines: number;
  unhealthyPipelines: number;
  totalThroughput: number;
  totalEventsProcessed: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  pipelines?: PipelineOverview[];
}

export interface PipelineOverview {
  pipelineId: string;
  success: boolean;
  pipeline: Pipeline;
  latest_metrics: Record<string, any>;
  throughput_series: Record<string, any>;
  health_series: any[];
  latest_collection: string;
  metrics_count: number;
}
