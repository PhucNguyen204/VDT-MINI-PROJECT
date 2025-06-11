import React, { useState, useEffect } from 'react';
import { Card, Badge } from '../ui/UIElements';
import { Button } from '../ui/FormElements';
import { realTimeCounterApi } from '../../services/api';
import { Activity, RefreshCw, BarChart3, Globe, FileText } from 'lucide-react';

interface LogCounterWidgetProps {
  pipelineId: string;
  pipelineName: string;
}

interface LogSource {
  type?: string;
  total_logs_received: number;
  new_logs_since_last_check: number;
  last_updated: string;
}

interface LogSummary {
  pipeline_id: string;
  monitoring_active: boolean;
  sources: Record<string, LogSource>;
  total_logs_across_all_sources: number;
  last_check_time: string;
}

export const LogCounterWidget: React.FC<LogCounterWidgetProps> = ({
  pipelineId,
  pipelineName
}) => {
  const [logSummary, setLogSummary] = useState<LogSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(true); // Always monitoring since backend is global
  const [error, setError] = useState<string | null>(null);

  // Auto-refresh interval - always active since monitoring is global
  useEffect(() => {
    // Initial load
    loadLogCounts();
    
    // Set up auto-refresh every 6 seconds
    const interval = setInterval(() => {
      loadLogCounts();
    }, 6000);

    return () => {
      clearInterval(interval);
    };
  }, [pipelineId]);
  const loadLogCounts = async () => {
    try {
      setError(null);
      const response = await realTimeCounterApi.getPipelineSummary(pipelineId);
      if (response.success) {
        setLogSummary(response.data);
      } else {
        setError('No data available - pipeline may not be running');
      }
    } catch (error: any) {
      console.error('Failed to load log counts:', error);
      setError('Failed to connect to monitoring service');
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      await realTimeCounterApi.forceUpdate(pipelineId);
      await loadLogCounts();
    } catch (error: any) {
      console.error('Failed to refresh:', error);
      setError('Failed to refresh counts');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };
  const getSourceIcon = (sourceType: string | undefined) => {
    switch (sourceType) {
      case 'http':
        return <Globe className="h-4 w-4 text-green-500" />;
      case 'file':
        return <FileText className="h-4 w-4 text-blue-500" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSourceBadgeVariant = (sourceType: string | undefined) => {
    switch (sourceType) {
      case 'http':
        return 'success';
      case 'file':
        return 'secondary';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Real-time Log Counter</h3>
          {isMonitoring && (
            <Badge variant="success" className="flex items-center space-x-1">
              <Activity className="h-3 w-3" />
              <span>Live</span>
            </Badge>
          )}
        </div>
          <div className="flex items-center space-x-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {!logSummary && !isLoading && (
        <div className="text-center py-8">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No log data available</p>
          <p className="text-sm text-gray-400 mt-1">
            Make sure the pipeline is running and receiving logs
          </p>
        </div>
      )}

      {isLoading && !logSummary && (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 text-blue-500 mx-auto mb-3 animate-spin" />
          <p className="text-gray-500">Loading log counts...</p>
        </div>
      )}

      {logSummary && (
        <div className="space-y-4">
          {/* Overall Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Logs Received</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatNumber(logSummary.total_logs_across_all_sources)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="text-sm font-medium text-gray-700">
                  {new Date(logSummary.last_check_time).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>

          {/* Source Breakdown */}
          {Object.keys(logSummary.sources).length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-gray-700">Sources</h4>
              {Object.entries(logSummary.sources).map(([sourceId, sourceData]) => (
                <div key={sourceId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getSourceIcon(sourceData.type)}
                      <span className="font-medium text-gray-900">{sourceId}</span>                      <Badge variant={getSourceBadgeVariant(sourceData.type)}>
                        {sourceData.type?.toUpperCase() || 'UNKNOWN'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {formatNumber(sourceData.total_logs_received)}
                      </p>
                      <p className="text-sm text-gray-500">total logs</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-600">New since last check: </span>
                      <span className="font-medium text-blue-600">
                        +{formatNumber(sourceData.new_logs_since_last_check)}
                      </span>
                    </div>
                    <div className="text-gray-500">
                      {new Date(sourceData.last_updated).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}          {/* Status */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 text-sm text-gray-500">
            <span>
              Real-time monitoring • Auto-refresh: 6s
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};