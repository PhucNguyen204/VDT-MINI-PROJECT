import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Database, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Play,
  Pause
} from 'lucide-react';
import { usePipelineStore, useMonitoringStore } from '../store';
import { Card } from '../components/ui/UIElements';
import { Badge } from '../components/ui/UIElements';
import { formatDate } from '../utils';

export const Dashboard: React.FC = () => {
  const { pipelines, loading, loadPipelines } = usePipelineStore();
  const { overview, loadOverview } = useMonitoringStore();

  useEffect(() => {
    loadPipelines();
    loadOverview();
  }, [loadPipelines, loadOverview]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-success-500" />;
      case 'stopped':
        return <Pause className="h-4 w-4 text-gray-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-error-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-warning-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'running':
        return 'success' as const;
      case 'stopped':
        return 'secondary' as const;
      case 'error':
        return 'error' as const;
      default:
        return 'warning' as const;
    }
  };  // Use overview data from API, fallback to pipeline count only for total
  const statCards = [
    {
      title: 'Total Pipelines',
      value: overview?.totalPipelines || pipelines.length,
      icon: Database,
      color: 'text-primary-600'
    },
    {
      title: 'Healthy',
      value: overview?.healthyPipelines || 0,
      icon: Play,
      color: 'text-success-600'
    },
    {
      title: 'Unhealthy',
      value: overview?.unhealthyPipelines || 0,
      icon: XCircle,
      color: 'text-error-600'
    },
    {
      title: 'Events Processed',
      value: overview?.totalEventsProcessed || 0,
      icon: BarChart3,
      color: 'text-primary-600'
    }
  ];

  const recentPipelines = pipelines.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Monitor and manage your vector data pipelines</p>
        </div>
        <Link
          to="/pipelines/create"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Pipeline
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.title}
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent Pipelines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Recent Pipelines</h2>
            <Link
              to="/pipelines"
              className="text-sm text-primary-600 hover:text-primary-500"
            >
              View all
            </Link>
          </div>
          
          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <div className="rounded-full bg-gray-200 h-10 w-10"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : recentPipelines.length === 0 ? (
            <div className="text-center py-6">
              <Database className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No pipelines</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by creating a new pipeline.</p>
              <div className="mt-6">
                <Link
                  to="/pipelines/create"
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Pipeline
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPipelines.map((pipeline) => (
                <Link
                  key={pipeline.id}
                  to={`/pipelines/${pipeline.id}`}
                  className="block hover:bg-gray-50 rounded-lg p-3 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(pipeline.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {pipeline.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Updated {formatDate(pipeline.updated_at)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusBadgeVariant(pipeline.status)}>
                      {pipeline.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/pipelines/create"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
            >
              <Plus className="h-8 w-8 text-primary-600 group-hover:text-primary-700" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Create New Pipeline</p>
                <p className="text-xs text-gray-500">Set up a new data processing pipeline</p>
              </div>
            </Link>
            
            <Link
              to="/monitoring"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
            >
              <BarChart3 className="h-8 w-8 text-primary-600 group-hover:text-primary-700" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">View Monitoring</p>
                <p className="text-xs text-gray-500">Check pipeline metrics and performance</p>
              </div>
            </Link>
            
            <Link
              to="/pipelines"
              className="flex items-center p-3 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
            >
              <Database className="h-8 w-8 text-primary-600 group-hover:text-primary-700" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-900">Manage Pipelines</p>
                <p className="text-xs text-gray-500">View and edit existing pipelines</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};
