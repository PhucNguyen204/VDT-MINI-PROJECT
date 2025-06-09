import React, { useEffect, useState } from 'react';
import { BarChart3, Activity, TrendingUp, AlertTriangle, RefreshCw, Play } from 'lucide-react';
import { useMonitoringStore } from '../store';
import { Card } from '../components/ui/UIElements';

export const Monitoring: React.FC = () => {
  const { overview, loading, loadOverview, collectMetrics } = useMonitoringStore();
  const [isCollecting, setIsCollecting] = useState(false);
  useEffect(() => {
    loadOverview();
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      loadOverview();
    }, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [loadOverview]);

  const handleCollectMetrics = async () => {
    setIsCollecting(true);
    try {
      await collectMetrics(); // Collect metrics for all pipelines
      await loadOverview(); // Refresh the overview after collecting
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    } finally {
      setIsCollecting(false);
    }
  };

  const handleRefresh = async () => {
    await loadOverview();
  };
  const systemMetrics = [
    {
      title: 'CPU Usage',
      value: overview?.avgCpuUsage || 0,
      unit: '%',
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Memory Usage',
      value: overview?.avgMemoryUsage || 0,
      unit: '%',
      icon: BarChart3,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Active Pipelines',
      value: overview?.healthyPipelines || 0,
      unit: '',
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Total Throughput',
      value: overview?.totalThroughput || 0,
      unit: '/s',
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    }
  ];

  return (
    <div className="space-y-6">      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monitoring Dashboard</h1>
          <p className="text-gray-600">Real-time monitoring of your data pipeline system</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleCollectMetrics}
            disabled={isCollecting || loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Play className={`h-4 w-4 mr-2 ${isCollecting ? 'animate-spin' : ''}`} />
            {isCollecting ? 'Collecting...' : 'Collect Metrics'}
          </button>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {systemMetrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title} className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-3 rounded-lg ${metric.bgColor}`}>
                  <Icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {metric.title}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {metric.value}
                        <span className="text-sm font-normal text-gray-500 ml-1">
                          {metric.unit}
                        </span>
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Performance */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pipeline Performance</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 mx-auto mb-4" />
              <p>Performance charts will be displayed here</p>
              <p className="text-sm mt-2">Connect to monitoring backend for real-time data</p>
            </div>
          </div>
        </Card>

        {/* System Health */}
        <Card className="p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Health</h3>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Activity className="h-12 w-12 mx-auto mb-4" />
              <p>System health metrics will be displayed here</p>
              <p className="text-sm mt-2">Real-time monitoring dashboard</p>
            </div>
          </div>
        </Card>
      </div>      {/* Pipeline Status */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pipeline Status Overview</h3>
        
        {loading ? (
          <div className="animate-pulse space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        ) : overview?.pipelines && overview.pipelines.length > 0 ? (
          <div className="space-y-4">
            {overview.pipelines.map((pipelineData: any) => (
              <div key={pipelineData.pipelineId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className={`h-3 w-3 rounded-full ${
                    pipelineData.pipeline.status === 'running' ? 'bg-green-500' : 
                    pipelineData.pipeline.status === 'stopped' ? 'bg-red-500' : 'bg-yellow-500'
                  }`}></div>
                  <div>
                    <h4 className="font-medium text-gray-900">{pipelineData.pipeline.name}</h4>
                    <p className="text-sm text-gray-500">Status: {pipelineData.pipeline.status}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    Metrics: {pipelineData.metrics_count || 0}
                  </p>
                  <p className="text-xs text-gray-500">
                    Last: {pipelineData.latest_collection ? 
                      new Date(pipelineData.latest_collection).toLocaleTimeString() : 'N/A'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-4" />
            <p>No pipeline data available</p>
            <p className="text-sm mt-2">Click "Collect Metrics" to gather pipeline information</p>
          </div>
        )}
      </Card>      {/* Recent Events */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Events</h3>
        <div className="space-y-3">
          {overview?.pipelines && overview.pipelines.length > 0 ? (
            overview.pipelines.map((pipelineData: any) => (
              <div key={pipelineData.pipelineId} className="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex-shrink-0">
                  <div className={`h-2 w-2 rounded-full ${
                    pipelineData.pipeline.status === 'running' ? 'bg-green-400' : 
                    pipelineData.pipeline.status === 'stopped' ? 'bg-red-400' : 'bg-yellow-400'
                  }`}></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">
                    Pipeline "{pipelineData.pipeline.name}" - {pipelineData.pipeline.status}
                  </p>
                  <p className="text-xs text-gray-500">
                    {pipelineData.latest_collection ? 
                      `Last metrics: ${new Date(pipelineData.latest_collection).toLocaleTimeString()}` :
                      'No metrics collected yet'
                    }
                  </p>
                </div>
              </div>
            ))
          ) : (
            <>
              <div className="flex items-center space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex-shrink-0">
                  <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">Monitoring system ready</p>
                  <p className="text-xs text-gray-500">Click "Collect Metrics" to start monitoring</p>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
};
