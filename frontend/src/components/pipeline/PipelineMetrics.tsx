import React, { useState, useEffect, useRef } from 'react';
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
  Table,
  Timer,
  Save,
  RotateCcw,
  BarChart4
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import { Card, Badge } from '../ui/UIElements';
import { Button, Select } from '../ui/FormElements';
import { metricsApi, schedulerApi } from '../../services/api';
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

interface AutoCollectionConfig {
  enabled: boolean;
  interval: number; // seconds
  lastRun?: string;
  nextRun?: string;
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

const AUTO_COLLECTION_INTERVALS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' }
];

export const PipelineMetrics: React.FC<PipelineMetricsProps> = ({
  pipelineId,
  pipelineName,
  pipelineStatus
}) => {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<MetricData[]>([]);
  const [healthStatus, setHealthStatus] = useState<HealthStatus>({ status: 'unknown', lastCheck: '' });
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [timeRange, setTimeRange] = useState('1h');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lastCollectionTime, setLastCollectionTime] = useState<string>('');
  const [showCurrentMetrics, setShowCurrentMetrics] = useState(true);
  const [showAutoCollectionSettings, setShowAutoCollectionSettings] = useState(false);
  const [chartDataPoints, setChartDataPoints] = useState<'10' | '20' | '50'>('10');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Auto-collection configuration
  const [autoCollectionConfig, setAutoCollectionConfig] = useState<AutoCollectionConfig>({
    enabled: false,
    interval: 60
  });
  const [tempInterval, setTempInterval] = useState(60);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const autoCollectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const nextRunTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        loadMetrics(),
        loadDashboard(),
        loadHealth(),
        loadSchedulerStatus()
      ]);
    };
    loadInitialData();
  }, [pipelineId, timeRange, selectedCategory]);

  // Setup auto-collection when enabled
  useEffect(() => {
    if (autoCollectionConfig.enabled && pipelineStatus === 'running') {
      setupAutoCollection();
    } else {
      clearAutoCollection();
    }

    return () => clearAutoCollection();
  }, [autoCollectionConfig.enabled, autoCollectionConfig.interval, pipelineStatus]);

  // Countdown timer effect
  useEffect(() => {
    if (autoCollectionConfig.enabled && remainingSeconds > 0) {
      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            return autoCollectionConfig.interval; // Reset to full interval
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [autoCollectionConfig.enabled, remainingSeconds, autoCollectionConfig.interval]);

  const setupAutoCollection = () => {
    clearAutoCollection();
    
    const intervalMs = autoCollectionConfig.interval * 1000;
    
    // Start countdown
    setRemainingSeconds(autoCollectionConfig.interval);
    
    // Immediate collection
    handleManualCollection();
    
    // Setup recurring collection
    autoCollectIntervalRef.current = setInterval(async () => {
      console.log(`🔄 Auto-collecting metrics for ${pipelineName} every ${autoCollectionConfig.interval}s`);
      setRemainingSeconds(autoCollectionConfig.interval); // Reset countdown
      await handleManualCollection();
    }, intervalMs);
    
    // Calculate next run time
    const nextRun = new Date(Date.now() + intervalMs);
    setAutoCollectionConfig(prev => ({
      ...prev,
      nextRun: nextRun.toISOString(),
      lastRun: new Date().toISOString()
    }));
  };

  const clearAutoCollection = () => {
    if (autoCollectIntervalRef.current) {
      clearInterval(autoCollectIntervalRef.current);
      autoCollectIntervalRef.current = null;
    }
    if (nextRunTimeoutRef.current) {
      clearTimeout(nextRunTimeoutRef.current);
      nextRunTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setRemainingSeconds(0);
  };

  const loadSchedulerStatus = async () => {
    try {
      const status = await schedulerApi.getStatus();
      if (status) {
        setAutoCollectionConfig(prev => ({
          ...prev,
          enabled: status.is_running || false,
          interval: status.interval_seconds || 60
        }));
        setTempInterval(status.interval_seconds || 60);
      }
    } catch (error) {
      console.error('Failed to load scheduler status:', error);
    }
  };

  const loadMetrics = async () => {
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
  };

  const handleManualCollection = async () => {
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
      
      // Update health status if available
      if (collectResponse.health_data) {
        setHealthStatus({
          status: collectResponse.health_data.healthy ? 'healthy' : 'error',
          lastCheck: currentTimestamp,
          details: collectResponse.health_data.details
        });
      }
      
      // Update auto-collection config with last run time
      setAutoCollectionConfig(prev => ({
        ...prev,
        lastRun: currentTimestamp
      }));
      
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
      if (!autoCollectionConfig.enabled) {
        // Start auto-collection with current interval
        await schedulerApi.start(autoCollectionConfig.interval);
        setAutoCollectionConfig(prev => ({ ...prev, enabled: true }));
        setRemainingSeconds(autoCollectionConfig.interval);
      } else {
        // Stop auto-collection
        await schedulerApi.stop();
        setAutoCollectionConfig(prev => ({ ...prev, enabled: false }));
        setRemainingSeconds(0);
      }
    } catch (error) {
      console.error('Failed to toggle auto-collection:', error);
    }
  };

  const handleSaveAutoCollectionSettings = async () => {
    try {
      if (autoCollectionConfig.enabled) {
        // Update scheduler interval
        await schedulerApi.updateInterval(tempInterval);
      }
      
      setAutoCollectionConfig(prev => ({
        ...prev,
        interval: tempInterval
      }));
      
      setShowAutoCollectionSettings(false);
    } catch (error) {
      console.error('Failed to save auto-collection settings:', error);
    }
  };

  const handleDeleteMetrics = async () => {
    try {
      setIsDeleting(true);
      const result = await metricsApi.deleteMetrics(pipelineId);
      
      console.log('✅ Metrics deleted:', result);
      
      // Clear local metrics data
      setMetrics([]);
      setCurrentMetrics([]);
      
      // Close confirm dialog
      setShowDeleteConfirm(false);
      
      // Optionally reload fresh data after a short delay
      setTimeout(() => {
        loadMetrics();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Failed to delete metrics:', error);
    } finally {
      setIsDeleting(false);
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

  const formatCountdown = (seconds: number) => {
    if (seconds <= 0) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
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

  const formatChartDataByMetric = () => {
    const limit = parseInt(chartDataPoints);
    const recentMetrics = metrics
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .reverse(); // Reverse to show oldest to newest

    // Group by metric type
    const metricGroups: Record<string, any[]> = {};
    
    recentMetrics.forEach(metric => {
      const metricKey = getMetricDisplayName(metric.metric_type);
      if (!metricGroups[metricKey]) {
        metricGroups[metricKey] = [];
      }
      
      metricGroups[metricKey].push({
        timestamp: metric.timestamp,
        time_label: new Date(metric.timestamp).toLocaleTimeString('vi-VN', { 
          hour: '2-digit', 
          minute: '2-digit'
        }),
        value: metric.value,
        unit: metric.unit
      });
    });

    return metricGroups;
  };

  const getMetricDisplayName = (metricType: string) => {
    const mapping: Record<string, string> = {
      'cpu_usage_percent': 'CPU (%)',
      'memory_usage_percent': 'Memory (%)', 
      'memory_usage': 'Memory (MB)',
      'network_rx': 'Network RX (KB)',
      'network_tx': 'Network TX (KB)', 
      'block_read': 'Block Read (KB)',
      'block_write': 'Block Write (KB)',
      'vector_health_status': 'Pipeline Health',
      'container_running': 'Container Status'
    };
    return mapping[metricType] || metricType;
  };

  const getMetricColor = (metricType: string) => {
    const colors: Record<string, string> = {
      'CPU (%)': '#3b82f6',
      'Memory (%)': '#10b981',
      'Memory (MB)': '#06b6d4',
      'Network RX (KB)': '#8b5cf6',
      'Network TX (KB)': '#a855f7',
      'Block Read (KB)': '#f59e0b',
      'Block Write (KB)': '#f97316',
      'Health': '#ef4444',
      'Metrics Count': '#6b7280'
    };
    return colors[metricType] || '#6b7280';
  };

  const getAvailableMetricTypes = () => {
    const metricGroups = formatChartDataByMetric();
    return Object.keys(metricGroups);
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
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Time Range Selector */}
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

          {/* Auto-collection Setup Button */}
          <Button
            variant="secondary"
            onClick={() => setShowAutoCollectionSettings(!showAutoCollectionSettings)}
            className="flex items-center"
          >
            <Timer className="h-4 w-4 mr-2" />
            Auto Setup
          </Button>

          {/* Auto-collect Toggle */}
          <Button
            variant={autoCollectionConfig.enabled ? "primary" : "secondary"}
            onClick={handleAutoCollectToggle}
            className="flex items-center"
          >
            {autoCollectionConfig.enabled ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                {remainingSeconds > 0 ? (
                  <span className="flex items-center">
                    Auto: ON
                    <span className="ml-1 px-2 py-1 bg-white/20 rounded text-xs font-mono">
                      {formatCountdown(remainingSeconds)}
                    </span>
                  </span>
                ) : (
                  `Auto: ON (${autoCollectionConfig.interval}s)`
                )}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Auto: OFF
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
          </Button>

          <Button
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

          {/* Clear All Metrics */}
          <Button
            variant="error"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={metrics.length === 0}
            className="flex items-center"
          >
            <XCircle className="h-4 w-4 mr-2" />
            Clear All ({metrics.length})
          </Button>
        </div>
      </div>

      {/* Auto-collection Settings Panel */}
      {showAutoCollectionSettings && (
        <Card className="p-6 border-l-4 border-l-blue-500 bg-blue-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-blue-600" />
              <h4 className="text-lg font-medium text-gray-900">Auto-Collection Settings</h4>
            </div>
            <Button
              variant="secondary"
              onClick={() => {
                setTempInterval(autoCollectionConfig.interval);
                setShowAutoCollectionSettings(false);
              }}
              className="text-sm"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Collection Interval
              </label>
                             <Select
                 value={tempInterval.toString()}
                 onChange={(value) => setTempInterval(parseInt(value))}
                 options={AUTO_COLLECTION_INTERVALS.map(opt => ({ ...opt, value: opt.value.toString() }))}
                 className="w-full"
               />
              <p className="text-xs text-gray-500 mt-1">
                How often to automatically collect metrics
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Status
              </label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Badge variant={autoCollectionConfig.enabled ? 'success' : 'secondary'}>
                    {autoCollectionConfig.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                  <span className="text-sm text-gray-600">
                    Current interval: {autoCollectionConfig.interval}s
                  </span>
                </div>
                {autoCollectionConfig.lastRun && (
                  <p className="text-xs text-gray-500">
                    Last run: {formatDate(autoCollectionConfig.lastRun)}
                  </p>
                )}
                {autoCollectionConfig.nextRun && autoCollectionConfig.enabled && (
                  <p className="text-xs text-gray-500">
                    Next run: {formatDate(autoCollectionConfig.nextRun)}
                  </p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="secondary"
              onClick={() => setTempInterval(60)}
              className="flex items-center"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button
              onClick={handleSaveAutoCollectionSettings}
              className="flex items-center"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </Card>
      )}

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
                {autoCollectionConfig.enabled ? (
                  remainingSeconds > 0 ? (
                    <span className="flex items-center">
                      <span className="mr-2">Next in</span>
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-mono">
                        {formatCountdown(remainingSeconds)}
                      </span>
                    </span>
                  ) : (
                    `Every ${autoCollectionConfig.interval}s`
                  )
                ) : (
                  'Disabled'
                )}
              </p>
            </div>
            <Zap className={`h-8 w-8 ${autoCollectionConfig.enabled ? 'text-green-500' : 'text-gray-400'}`} />
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
      </div>

      {/* Metrics Display */}
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
                <div className="flex items-center space-x-3">
                  <Select
                    value={chartDataPoints}
                    onChange={(value) => setChartDataPoints(value as '10' | '20' | '50')}
                    options={[
                      { value: '10', label: '10 lần gần nhất' },
                      { value: '20', label: '20 lần gần nhất' },
                      { value: '50', label: '50 lần gần nhất' }
                    ]}
                    className="w-auto"
                  />
                  <Badge variant="secondary">
                    {TIME_RANGES.find(r => r.value === timeRange)?.label}
                  </Badge>
                </div>
              </div>

              {/* Individual Line Charts */}
              {getAvailableMetricTypes().length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <BarChart4 className="h-5 w-5 text-blue-600" />
                      <h5 className="text-lg font-medium text-gray-900">
                        Biểu đồ Metrics ({chartDataPoints} lần gần nhất)
                      </h5>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(formatChartDataByMetric()).map(([metricType, data]) => (
                      <Card key={metricType} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h6 className="text-sm font-medium text-gray-900">{metricType}</h6>
                          <Badge variant="secondary" className="text-xs">
                            {data.length} points
                          </Badge>
                        </div>
                        
                        <div className="h-32 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={data}
                              margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis 
                                dataKey="time_label"
                                tick={{ fontSize: 10 }}
                                interval="preserveStartEnd"
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis 
                                tick={{ fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={30}
                              />
                              <Tooltip 
                                labelFormatter={(label) => `Time: ${label}`}
                                formatter={(value: any) => {
                                  if (metricType.includes('(%)')) {
                                    return [`${value.toFixed(2)}%`, metricType];
                                  } else if (metricType.includes('(MB)')) {
                                    return [`${(value / (1024 * 1024)).toFixed(2)} MB`, metricType];
                                  } else if (metricType.includes('(KB)')) {
                                    return [`${(value / 1024).toFixed(2)} KB`, metricType];
                                  }
                                  return [value.toFixed(2), metricType];
                                }}
                                contentStyle={{
                                  backgroundColor: '#f9fafb',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '6px',
                                  fontSize: '12px'
                                }}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke={getMetricColor(metricType)} 
                                strokeWidth={2}
                                dot={{ fill: getMetricColor(metricType), r: 3 }}
                                activeDot={{ r: 4, stroke: getMetricColor(metricType), strokeWidth: 2, fill: '#fff' }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* Mini stats */}
                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                          <span>
                            Latest: {data.length > 0 ? 
                              (metricType.includes('(%)') ? 
                                `${data[data.length - 1].value.toFixed(1)}%` :
                              metricType.includes('(MB)') ?
                                `${(data[data.length - 1].value / (1024 * 1024)).toFixed(1)} MB` :
                              metricType.includes('(KB)') ?
                                `${(data[data.length - 1].value / 1024).toFixed(1)} KB` :
                                data[data.length - 1].value.toFixed(1)
                              ) : 'N/A'
                            }
                          </span>
                          <span>
                            Avg: {data.length > 0 ? 
                              (metricType.includes('(%)') ? 
                                `${(data.reduce((a, b) => a + b.value, 0) / data.length).toFixed(1)}%` :
                              metricType.includes('(MB)') ?
                                `${((data.reduce((a, b) => a + b.value, 0) / data.length) / (1024 * 1024)).toFixed(1)} MB` :
                              metricType.includes('(KB)') ?
                                `${((data.reduce((a, b) => a + b.value, 0) / data.length) / 1024).toFixed(1)} KB` :
                                (data.reduce((a, b) => a + b.value, 0) / data.length).toFixed(1)
                              ) : 'N/A'
                            }
                          </span>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
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
        ) : (
          <Card className="p-8">
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <AlertTriangle className="h-8 w-8 text-red-500 mr-3" />
                <h3 className="text-lg font-medium text-gray-900">
                  Xác nhận xóa toàn bộ metrics
                </h3>
              </div>
              
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-3">
                  Bạn có chắc chắn muốn xóa <strong>toàn bộ {metrics.length} metrics</strong> đã thu thập của pipeline{' '}
                  <strong className="text-blue-600">{pipelineName}</strong>?
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 font-medium mb-1">⚠️ Cảnh báo:</p>
                  <p className="text-sm text-red-600">
                    Hành động này không thể hoàn tác. Tất cả dữ liệu metrics lịch sử sẽ bị xóa vĩnh viễn khỏi database.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Hủy bỏ
                </Button>
                <Button
                  variant="error"
                  onClick={handleDeleteMetrics}
                  disabled={isDeleting}
                  className="flex items-center"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Đang xóa...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Xóa toàn bộ ({metrics.length})
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
