import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Activity,
  Clock,
  Zap,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Settings,
  Play,
  Pause,
  Table
} from 'lucide-react';
import { Card, Badge } from '../ui/UIElements';
import { Button, Select } from '../ui/FormElements';
import { metricsApi } from '../../services/api';
import { formatDate } from '../../utils';

interface PipelineMetricsProps {
  pipelineId: string;
  pipelineName: string;
  pipelineStatus: string;
}

interface MetricData {
  timestamp: string;
  category: string;
  metric_type: string;
  value: number;
  unit?: string;
  tags?: Record<string, any>;
}

interface HealthStatus {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  lastCheck: string;
  details?: string;
}

const TIME_RANGES = [
  { value: '15m', label: '15 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '4h', label: '4 hours' },
  { value: '12h', label: '12 hours' },
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' }
];

const METRIC_CATEGORIES = [
  { value: 'all', label: 'All Metrics' },
  { value: 'prometheus', label: 'Prometheus' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'container_stats', label: 'Container Stats' },
  { value: 'health', label: 'Health' }
];

export const PipelineMetrics: React.FC<PipelineMetricsProps> = ({
  pipelineId,
  pipelineName,
  pipelineStatus
}) => {  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricData[]>([]);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ status: 'unknown', lastCheck: '' });
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [autoCollectEnabled, setAutoCollectEnabled] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lastCollectionTime, setLastCollectionTime] = useState<string>('');
  const [showCurrentMetrics, setShowCurrentMetrics] = useState(true);
  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        loadMetrics(),
        loadDashboard(),
        loadHealth()
      ]);
    };
    loadInitialData();
  }, [pipelineId, timeRange, selectedCategory]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoCollectEnabled) return;

    const interval = setInterval(async () => {
      await Promise.all([
        loadMetrics(),
        loadHealth()
      ]);
    }, 30000);

    return () => clearInterval(interval);
  }, [autoCollectEnabled, timeRange, selectedCategory]);  const loadMetrics = async () => {
    try {
      setLoading(true);
      const category = selectedCategory === 'all' ? undefined : selectedCategory;
      const response = await metricsApi.getMetrics(pipelineId, timeRange, category);
      
      console.log('Metrics API Response:', response);
      
      // Transform backend response to expected format
      const transformedMetrics: MetricData[] = [];
      
      if (response.metrics_by_type) {
        Object.entries(response.metrics_by_type).forEach(([category, categoryMetrics]: [string, any]) => {
          if (Array.isArray(categoryMetrics)) {
            categoryMetrics.forEach((metric: any) => {
              // Handle different metric value formats
              let metricValue = 0;
              let metricUnit = metric.unit;
              
              if (typeof metric.metric_value === 'string') {
                // Parse different formats like "0.07%", "124.4MiB", etc.
                const value = metric.metric_value.trim();
                
                if (value.includes('%')) {
                  metricValue = parseFloat(value.replace('%', ''));
                  metricUnit = 'percent';
                } else if (value.includes('MiB') || value.includes('GiB') || value.includes('KB')) {
                  // Parse memory values
                  const numPart = value.match(/[\d.]+/);
                  if (numPart) {
                    metricValue = parseFloat(numPart[0]);
                    if (value.includes('GiB')) {
                      metricValue = metricValue * 1024 * 1024 * 1024;
                      metricUnit = 'bytes';
                    } else if (value.includes('MiB')) {
                      metricValue = metricValue * 1024 * 1024;
                      metricUnit = 'bytes';
                    } else if (value.includes('kB')) {
                      metricValue = metricValue * 1024;
                      metricUnit = 'bytes';
                    }
                  }
                } else {
                  metricValue = parseFloat(value) || 0;
                }
              } else {
                metricValue = parseFloat(metric.metric_value) || 0;
              }
              
              transformedMetrics.push({
                timestamp: metric.collected_at || metric.timestamp,
                category: category,
                metric_type: metric.metric_name || metric.metric_type || 'unknown',
                value: metricValue,
                unit: metricUnit,
                tags: metric.tags || {}
              });
            });
          }
        });
      }
      
      console.log('Transformed metrics:', transformedMetrics);
      setMetrics(transformedMetrics);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      setLoading(false);
    }
  };
  const loadDashboard = async () => {
    try {
      await metricsApi.getDashboard(pipelineId, timeRange);
      // Dashboard data can be used for advanced metrics visualization in the future
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await metricsApi.getHealth(pipelineId);
      setHealthStatus({
        status: response.healthCheck?.status || 'unknown',
        lastCheck: response.timestamp,
        details: response.healthCheck?.details
      });
    } catch (error) {
      console.error('Failed to load health:', error);
      setHealthStatus({ status: 'error', lastCheck: new Date().toISOString() });
    }
  };  const handleManualCollection = async () => {
    try {
      setCollecting(true);
      const collectResponse = await metricsApi.collect(pipelineId);
      setLastCollectionTime(new Date().toISOString());
      
      console.log('Collection Response:', collectResponse);
      
      // Parse immediate metrics from collect response
      const immediateMetrics: MetricData[] = [];
      const currentTimestamp = new Date().toISOString();
      
      // Parse stats_data if available (CPU, Memory, Network, Block I/O)
      if (collectResponse.stats_data && collectResponse.stats_data.stats) {
        const statsString = collectResponse.stats_data.stats;
        console.log('Parsing stats string:', statsString);
        
        // Parse CPU percentage (look for pattern like "0.07%")
        const cpuMatch = statsString.match(/([\d.]+)%/);
        if (cpuMatch) {
          const cpuValue = parseFloat(cpuMatch[1]);
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'cpu_usage_percent',
            value: cpuValue,
            unit: 'percent',
            tags: { source: 'docker_stats', raw_stats: statsString }
          });
          console.log('Parsed CPU:', cpuValue + '%');
        }
        
        // Parse Memory usage (look for pattern like "124.4MiB / 7.672GiB")
        const memoryMatch = statsString.match(/([\d.]+)(MiB|GiB)\s*\/\s*([\d.]+)(MiB|GiB)/);
        if (memoryMatch) {
          let memoryUsed = parseFloat(memoryMatch[1]);
          let memoryLimit = parseFloat(memoryMatch[3]);
          
          // Convert to bytes
          const memoryUsedUnit = memoryMatch[2];
          const memoryLimitUnit = memoryMatch[4];
          
          if (memoryUsedUnit === 'GiB') memoryUsed *= 1024 * 1024 * 1024;
          else if (memoryUsedUnit === 'MiB') memoryUsed *= 1024 * 1024;
          
          if (memoryLimitUnit === 'GiB') memoryLimit *= 1024 * 1024 * 1024;
          else if (memoryLimitUnit === 'MiB') memoryLimit *= 1024 * 1024;
          
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'memory_usage',
            value: memoryUsed,
            unit: 'bytes',
            tags: { source: 'docker_stats' }
          });
          
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'memory_limit',
            value: memoryLimit,
            unit: 'bytes',
            tags: { source: 'docker_stats' }
          });
          
          // Calculate memory percentage
          const memoryPercent = (memoryUsed / memoryLimit) * 100;
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'memory_usage_percent',
            value: memoryPercent,
            unit: 'percent',
            tags: { source: 'docker_stats' }
          });
          
          console.log('Parsed Memory:', `${memoryUsed} bytes (${memoryPercent.toFixed(1)}%)`);
        }
        
        // Parse Network I/O (look for pattern like "1.44kB / 0B")
        const networkMatch = statsString.match(/([\d.]+)(kB|MB|GB|B)\s*\/\s*([\d.]+)(kB|MB|GB|B)/);
        if (networkMatch) {
          let networkIn = parseFloat(networkMatch[1]);
          let networkOut = parseFloat(networkMatch[3]);
          
          // Convert to bytes
          const convertToBytes = (value: number, unit: string) => {
            switch (unit) {
              case 'GB': return value * 1024 * 1024 * 1024;
              case 'MB': return value * 1024 * 1024;
              case 'kB': return value * 1024;
              case 'B': return value;
              default: return value;
            }
          };
          
          networkIn = convertToBytes(networkIn, networkMatch[2]);
          networkOut = convertToBytes(networkOut, networkMatch[4]);
          
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'network_rx',
            value: networkIn,
            unit: 'bytes',
            tags: { source: 'docker_stats' }
          });
          
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'network_tx',
            value: networkOut,
            unit: 'bytes',
            tags: { source: 'docker_stats' }
          });
          
          console.log('Parsed Network:', `RX: ${networkIn} bytes, TX: ${networkOut} bytes`);
        }
        
        // Parse Block I/O (last part of stats)
        const blockMatch = statsString.match(/([\d.]+)(kB|MB|GB|B)\s*\/\s*([\d.]+)(kB|MB|GB|B)(?!.*\/)/);
        if (blockMatch && blockMatch !== networkMatch) {
          let blockRead = parseFloat(blockMatch[1]);
          let blockWrite = parseFloat(blockMatch[3]);
          
          const convertToBytes = (value: number, unit: string) => {
            switch (unit) {
              case 'GB': return value * 1024 * 1024 * 1024;
              case 'MB': return value * 1024 * 1024;
              case 'kB': return value * 1024;
              case 'B': return value;
              default: return value;
            }
          };
          
          blockRead = convertToBytes(blockRead, blockMatch[2]);
          blockWrite = convertToBytes(blockWrite, blockMatch[4]);
          
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'block_read',
            value: blockRead,
            unit: 'bytes',
            tags: { source: 'docker_stats' }
          });
          
          immediateMetrics.push({
            timestamp: currentTimestamp,
            category: 'container_stats',
            metric_type: 'block_write',
            value: blockWrite,
            unit: 'bytes',
            tags: { source: 'docker_stats' }
          });
          
          console.log('Parsed Block I/O:', `Read: ${blockRead} bytes, Write: ${blockWrite} bytes`);
        }
      }
      
      // Add health status as metric
      if (collectResponse.health_data) {
        immediateMetrics.push({
          timestamp: currentTimestamp,
          category: 'health',
          metric_type: 'pipeline_health',
          value: collectResponse.health_data.healthy ? 1 : 0,
          unit: 'boolean',
          tags: { 
            status: collectResponse.health_data.status,
            details: collectResponse.health_data.details 
          }
        });
      }
      
      // Add collection summary metrics
      if (collectResponse.metrics_collected !== undefined) {
        immediateMetrics.push({
          timestamp: currentTimestamp,
          category: 'collection',
          metric_type: 'metrics_collected',
          value: collectResponse.metrics_collected,
          unit: 'count',
          tags: { 
            pipeline_status: collectResponse.pipeline_status,
            collection_time: currentTimestamp
          }
        });
      }
        console.log('Immediate metrics parsed:', immediateMetrics);
      
      // Update current metrics state for immediate display
      setCurrentMetrics(immediateMetrics);
      setLastCollectionTime(currentTimestamp);
      
      // Add to historical metrics as well
      if (immediateMetrics.length > 0) {
        setMetrics(prevMetrics => {
          // Remove any existing metrics from the same timestamp to avoid duplicates
          const filtered = prevMetrics.filter(m => 
            new Date(m.timestamp).getTime() !== new Date(currentTimestamp).getTime()
          );
          // Add new metrics to the beginning
          const updated = [...immediateMetrics, ...filtered];
          console.log('Updated historical metrics:', updated.length, 'total metrics');
          return updated;
        });
      }
        // Cập nhật health status nếu có
      if (collectResponse.health_data) {
        setHealthStatus({
          status: collectResponse.health_data.healthy ? 'healthy' : 'error',
          lastCheck: currentTimestamp,
          details: collectResponse.health_data.details
        });
      }
      
      // Refresh historical metrics from database after a short delay
      setTimeout(async () => {
        console.log('Refreshing historical metrics from database...');
        await loadMetrics();
        await loadHealth();
      }, 2000);
      
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    } finally {
      setCollecting(false);
    }
  };

  const handleAutoCollectToggle = async () => {
    try {
      if (!autoCollectEnabled) {
        // Start auto-collection by collecting all pipelines
        await metricsApi.collectAll();
      }
      setAutoCollectEnabled(!autoCollectEnabled);
    } catch (error) {
      console.error('Failed to toggle auto-collection:', error);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getHealthBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'success' as const;
      case 'warning':
        return 'warning' as const;
      case 'error':
        return 'error' as const;
      default:
        return 'secondary' as const;
    }
  };

  const formatMetricValue = (value: number, unit?: string) => {
    if (unit === 'bytes') {
      return formatBytes(value);
    }
    if (unit === 'percent') {
      return `${value.toFixed(1)}%`;
    }
    if (unit === 'duration') {
      return `${value.toFixed(2)}ms`;
    }
    return value.toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const groupMetricsByType = (metrics: MetricData[]) => {
    return metrics.reduce((acc, metric) => {
      const key = `${metric.category}_${metric.metric_type}`;
      if (!acc[key]) {
        acc[key] = {
          category: metric.category,
          type: metric.metric_type,
          unit: metric.unit,
          values: []
        };
      }
      acc[key].values.push({
        timestamp: metric.timestamp,
        value: metric.value,
        tags: metric.tags
      });
      return acc;
    }, {} as Record<string, any>);
  };

  const getTrendIcon = (values: number[]) => {
    if (values.length < 2) return <Minus className="h-4 w-4 text-gray-400" />;
    const latest = values[values.length - 1];
    const previous = values[values.length - 2];
    
    if (latest > previous) {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    } else if (latest < previous) {
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const groupedMetrics = groupMetricsByType(metrics);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-medium text-gray-900">Pipeline Metrics</h3>
          <div className="flex items-center space-x-2">
            {getHealthIcon(healthStatus.status)}
            <Badge variant={getHealthBadgeVariant(healthStatus.status)}>
              {healthStatus.status.toUpperCase()}
            </Badge>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">          {/* Time Range Selector */}
          <Select
            value={timeRange}
            onChange={setTimeRange}
            options={TIME_RANGES}
            className="w-auto"
          />

          {/* Category Filter */}
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            options={METRIC_CATEGORIES}
            className="w-auto"
          />

          {/* Auto-collect Toggle */}
          <Button
            variant={autoCollectEnabled ? "primary" : "secondary"}
            onClick={handleAutoCollectToggle}
            className="flex items-center"
          >
            {autoCollectEnabled ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Auto Collect: ON
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Auto Collect: OFF
              </>
            )}
          </Button>

          {/* Manual Collection */}
          <Button
            onClick={handleManualCollection}
            disabled={collecting || pipelineStatus !== 'running'}
            className="flex items-center"
          >
            {collecting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Collecting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Collect Now
              </>
            )}
          </Button>          <Button
            variant="secondary"
            onClick={loadMetrics}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>

          {/* View Toggle */}
          <Button
            variant={showCurrentMetrics ? "primary" : "secondary"}
            onClick={() => setShowCurrentMetrics(!showCurrentMetrics)}
            className="flex items-center"
          >
            <Table className="h-4 w-4 mr-2" />
            {showCurrentMetrics ? 'Current View' : 'Historical View'}
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Health Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Health Status</p>
              <div className="flex items-center space-x-2 mt-1">
                {getHealthIcon(healthStatus.status)}
                <span className="font-medium text-gray-900 capitalize">
                  {healthStatus.status}
                </span>
              </div>
            </div>
            <Activity className="h-8 w-8 text-blue-500" />
          </div>
          {healthStatus.lastCheck && (
            <p className="text-xs text-gray-400 mt-2">
              Last check: {formatDate(healthStatus.lastCheck)}
            </p>
          )}
        </Card>

        {/* Total Metrics */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Metrics</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.length}</p>
            </div>
            <BarChart3 className="h-8 w-8 text-green-500" />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            In {TIME_RANGES.find(r => r.value === timeRange)?.label}
          </p>
        </Card>

        {/* Auto Collection Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Auto Collection</p>
              <p className="text-lg font-medium text-gray-900">
                {autoCollectEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Zap className={`h-8 w-8 ${autoCollectEnabled ? 'text-green-500' : 'text-gray-400'}`} />
          </div>
          {lastCollectionTime && (
            <p className="text-xs text-gray-400 mt-2">
              Last: {formatDate(lastCollectionTime)}
            </p>
          )}
        </Card>

        {/* Time Range */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Time Range</p>
              <p className="text-lg font-medium text-gray-900">
                {TIME_RANGES.find(r => r.value === timeRange)?.label}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-500" />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {selectedCategory === 'all' ? 'All categories' : selectedCategory}
          </p>
        </Card>
      </div>      {/* Metrics Display */}
      {showCurrentMetrics ? (
        /* Current/Real-time Metrics View */
        currentMetrics.length > 0 ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900">Latest Collection Results</h4>
              <Badge variant="success" className="animate-pulse">LIVE</Badge>
            </div>
            
            {/* Current Metrics Cards - Enhanced */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {groupMetricsByType(currentMetrics) && Object.entries(groupMetricsByType(currentMetrics)).map(([key, metricGroup]) => {
                const latestMetric = metricGroup.values[metricGroup.values.length - 1];
                
                return (
                  <Card key={key} className="p-6 border-l-4 border-l-green-500 bg-gradient-to-r from-green-50 to-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900">
                          {metricGroup.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </h5>
                        <p className="text-sm text-gray-600 capitalize font-medium">{metricGroup.category}</p>
                      </div>
                      <Badge variant="success" className="text-xs animate-bounce">FRESH</Badge>
                    </div>
                    
                    {/* Large Value Display */}
                    <div className="mb-4">
                      <span className="text-3xl font-bold text-gray-900 block">
                        {formatMetricValue(latestMetric?.value || 0, metricGroup.unit)}
                      </span>
                    </div>
                    
                    {/* Metadata */}
                    <div className="space-y-1">
                      <p className="text-sm text-gray-500">
                        <strong>Collected:</strong> {formatDate(latestMetric?.timestamp)}
                      </p>
                      {latestMetric?.tags?.source && (
                        <p className="text-sm text-gray-500">
                          <strong>Source:</strong> {latestMetric.tags.source}
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Quick Summary Stats */}
            <Card className="p-6 bg-blue-50">
              <h5 className="text-lg font-medium text-gray-900 mb-3">Collection Summary</h5>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{currentMetrics.length}</p>
                  <p className="text-sm text-gray-600">Metrics Collected</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {new Set(currentMetrics.map(m => m.category)).size}
                  </p>
                  <p className="text-sm text-gray-600">Categories</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {currentMetrics.filter(m => m.category === 'container_stats').length}
                  </p>
                  <p className="text-sm text-gray-600">Container Stats</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {lastCollectionTime ? 'Just Now' : 'Never'}
                  </p>
                  <p className="text-sm text-gray-600">Last Collection</p>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Card className="p-8">
            <div className="text-center">
              <div className="space-y-4">
                <Download className="h-16 w-16 mx-auto text-gray-300" />
                <div>
                  <p className="text-lg text-gray-600 mb-2">No Current Metrics</p>
                  <p className="text-sm text-gray-400">
                    Click "Collect Now" to gather fresh metrics data and see real-time results
                  </p>
                </div>
                {pipelineStatus === 'running' && (
                  <Button onClick={handleManualCollection} disabled={collecting} size="lg">
                    <Download className="h-5 w-5 mr-2" />
                    Start Collection
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )
      ) : (
        /* Historical Metrics View */
        Object.keys(groupedMetrics).length > 0 ? (
          <div className="space-y-6">
            {/* Historical Metrics Cards with Trends */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Historical Metrics Overview</h4>
                <Badge variant="secondary">
                  {TIME_RANGES.find(r => r.value === timeRange)?.label}
                </Badge>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(groupedMetrics).map(([key, metricGroup]) => {
                  const latestMetric = metricGroup.values[metricGroup.values.length - 1];
                  const values = metricGroup.values.map((v: any) => v.value);
                  const avgValue = values.reduce((a: number, b: number) => a + b, 0) / values.length;
                  const maxValue = Math.max(...values);
                  const minValue = Math.min(...values);
                  
                  return (
                    <Card key={key} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900">
                            {metricGroup.type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </h5>
                          <p className="text-xs text-gray-500 capitalize">{metricGroup.category}</p>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Badge variant="secondary" className="text-xs">{values.length} points</Badge>
                          {getTrendIcon(values)}
                        </div>
                      </div>
                      
                      {/* Current Value */}
                      <div className="mb-3">
                        <span className="text-xl font-bold text-gray-900">
                          {formatMetricValue(latestMetric?.value || 0, metricGroup.unit)}
                        </span>
                        <p className="text-xs text-gray-400">Current</p>
                      </div>
                      
                      {/* Statistics */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <p className="text-gray-500">Avg</p>
                          <p className="font-medium">{formatMetricValue(avgValue, metricGroup.unit)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Max</p>
                          <p className="font-medium">{formatMetricValue(maxValue, metricGroup.unit)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Min</p>
                          <p className="font-medium">{formatMetricValue(minValue, metricGroup.unit)}</p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Historical Metrics Table */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Detailed History</h4>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Timestamp
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Metric Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Source
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {metrics
                        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                        .slice(0, 50) // Show last 50 metrics for history
                        .map((metric, index) => {
                          const isRecent = 
                            new Date(metric.timestamp).getTime() > Date.now() - 300000; // 5 minutes
                          
                          return (
                            <tr key={`${metric.timestamp}-${metric.metric_type}-${index}`} 
                                className={isRecent ? 'bg-yellow-50' : ''}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatDate(metric.timestamp)}
                                {isRecent && (
                                  <Badge variant="warning" className="ml-2 text-xs">RECENT</Badge>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <Badge variant="secondary" className="text-xs capitalize">
                                  {metric.category}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {metric.metric_type.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {formatMetricValue(metric.value, metric.unit)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                                {metric.tags?.source || 'unknown'}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                  
                  {metrics.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-gray-500">No historical metrics data available</p>
                    </div>
                  )}
                  
                  {metrics.length > 50 && (
                    <div className="bg-gray-50 px-6 py-3 border-t">
                      <p className="text-sm text-gray-500">
                        Showing latest 50 of {metrics.length} total metrics. 
                        Use time range filter to view more specific data.
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>
        ) : (<          <Card className="p-8">
            <div className="text-center">
              {loading ? (
                <div className="space-y-4">
                  <RefreshCw className="h-12 w-12 mx-auto text-gray-400 animate-spin" />
                  <p className="text-gray-500">Loading metrics...</p>
                </div>
              ) : collecting ? (
                <div className="space-y-4">
                  <Download className="h-12 w-12 mx-auto text-blue-500 animate-bounce" />
                  <p className="text-gray-500">Collecting metrics...</p>
                  <p className="text-sm text-gray-400">This may take a few seconds</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-gray-500 mb-2">No historical metrics available for the selected time range</p>
                    <p className="text-sm text-gray-400">
                      {pipelineStatus !== 'running' 
                        ? 'Pipeline must be running to collect metrics'
                        : 'Click "Collect Now" to gather fresh metrics data'
                      }
                    </p>
                  </div>
                  {pipelineStatus === 'running' && (
                    <Button onClick={handleManualCollection} disabled={collecting}>
                      <Download className="h-4 w-4 mr-2" />
                      Collect Metrics Now
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        )
      )}

      {/* Health Details */}
      {healthStatus.details && (
        <Card className="p-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Health Details
          </h4>
          <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
            {healthStatus.details}
          </pre>
        </Card>
      )}
    </div>
  );
};
