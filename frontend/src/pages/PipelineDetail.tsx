import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  BarChart3, 
  FileText, 
  Edit,
  Trash2,
  RefreshCw,
  Server,
  Database,
  Workflow,
  Container,
  FileCode,
  Network,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { PipelineFlowVisualization } from '../components/pipeline/PipelineFlowVisualization';
import { PipelineMetrics } from '../components/pipeline/PipelineMetrics';
import { usePipelineStore } from '../store';
import { Card, Badge, Tabs, TabsContent, TabsList, TabsTrigger, Modal } from '../components/ui/UIElements';
import { Button } from '../components/ui/FormElements';
import { formatDate } from '../utils';

export const PipelineDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { 
    pipelines, 
    currentPipeline,
    loading, 
    loadPipeline,
    deletePipeline, 
    stopPipeline,
    restartPipeline 
  } = usePipelineStore();

  const [deleteModal, setDeleteModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Use currentPipeline for detail view, fallback to list pipeline
  const pipeline = currentPipeline || pipelines.find(p => p.id === id);
  
  useEffect(() => {
    if (id && (!currentPipeline || currentPipeline.id !== id)) {
      loadPipeline(id);
    }
  }, [id, currentPipeline, loadPipeline]);

  const handleTogglePipeline = async () => {
    if (!pipeline) return;
    
    try {
      if (pipeline.status === 'running') {
        await stopPipeline(pipeline.id);
      } else {
        await restartPipeline(pipeline.id);
      }
    } catch (error) {
      console.error('Failed to toggle pipeline:', error);
    }
  };

  const handleDeletePipeline = async () => {
    if (!pipeline) return;
    
    try {
      await deletePipeline(pipeline.id);
      navigate('/pipelines');
    } catch (error) {
      console.error('Failed to delete pipeline:', error);
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
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'stopped':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  // Enhanced helper functions for detailed information display
  const formatSourceDetails = (sourcesConfig: any) => {
    if (!sourcesConfig || Object.keys(sourcesConfig).length === 0) {
      return { sources: [], totalCount: 0 };
    }
    
    const sources = Object.entries(sourcesConfig).map(([sourceId, sourceConfig]: [string, any]) => ({
      id: sourceId,
      type: sourceConfig.type,
      icon: getSourceIcon(sourceConfig.type),
      config: sourceConfig,
      description: getSourceDescription(sourceConfig)
    }));
    
    return {
      sources,
      totalCount: sources.length
    };
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="h-5 w-5 text-blue-500" />;
      case 'http':
        return <Network className="h-5 w-5 text-green-500" />;
      case 'prometheus_scrape':
        return <BarChart3 className="h-5 w-5 text-orange-500" />;
      case 'docker_logs':
        return <Container className="h-5 w-5 text-purple-500" />;
      default:
        return <Server className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSourceDescription = (sourceConfig: any) => {
    switch (sourceConfig.type) {
      case 'file':
        const patterns = sourceConfig.include || [];
        return patterns.length > 0 
          ? `Monitoring ${patterns.length} file pattern(s): ${patterns.slice(0, 2).join(', ')}${patterns.length > 2 ? '...' : ''}`
          : 'No file patterns specified';
      case 'http':
        return `HTTP Server listening on port ${sourceConfig.listen_port || 'default'}`;
      case 'prometheus_scrape':
        const endpoints = sourceConfig.endpoints || [];
        return `Scraping ${endpoints.length} endpoint(s) every ${sourceConfig.scrape_interval_secs || 15}s`;
      case 'docker_logs':
        return 'Collecting Docker container logs';
      default:
        return 'Custom source configuration';
    }
  };

  const formatTransformDetails = (transformsConfig: any) => {
    if (!transformsConfig || Object.keys(transformsConfig).length === 0) {
      return { transforms: [], totalCount: 0 };
    }
    
    const transforms = Object.entries(transformsConfig).map(([sourceId, transformList]: [string, any]) => ({
      sourceId,
      transforms: Array.isArray(transformList) ? transformList : [],
      count: Array.isArray(transformList) ? transformList.length : 0
    }));
    
    const totalCount = transforms.reduce((acc, t) => acc + t.count, 0);
    
    return {
      transforms,
      totalCount
    };
  };
  const formatSinkDetails = (sinksConfig: any) => {
    if (!sinksConfig || Object.keys(sinksConfig).length === 0) {
      return { sinks: [], totalCount: 0, uniqueTypes: [] };
    }
    
    const sinks = Object.entries(sinksConfig).map(([sourceId, sinkList]: [string, any]) => ({
      sourceId,
      sinks: Array.isArray(sinkList) ? sinkList : [],
      count: Array.isArray(sinkList) ? sinkList.length : 0
    }));
    
    const allSinks = sinks.flatMap(s => s.sinks);
    // Extract type from both string and object formats
    const allTypes = allSinks.map(sink => {
      if (typeof sink === 'string') {
        return sink;
      } else if (typeof sink === 'object' && sink.type) {
        return sink.type;
      }
      return 'unknown';
    });
    const uniqueTypes = Array.from(new Set(allTypes));
    
    return {
      sinks,
      totalCount: allSinks.length,
      uniqueTypes
    };
  };
  const getSinkIcon = (type: string) => {
    // Ensure type is a string
    const typeStr = String(type || 'unknown');
    
    switch (typeStr) {
      case 's3':
        return <Database className="h-4 w-4 text-orange-500" />;
      case 'console':
        return <FileCode className="h-4 w-4 text-gray-500" />;
      case 'cloudwatch':
        return <BarChart3 className="h-4 w-4 text-blue-500" />;
      case 'elasticsearch':
        return <Server className="h-4 w-4 text-green-500" />;
      default:
        return <Database className="h-4 w-4 text-gray-500" />;
    }
  };
  const getSinkDisplayName = (type: string) => {
    // Ensure type is a string
    const typeStr = String(type || 'unknown');
    
    switch (typeStr) {
      case 's3':
        return 'AWS S3';
      case 'console':
        return 'Console Output';
      case 'cloudwatch':
        return 'CloudWatch';
      case 'elasticsearch':
        return 'Elasticsearch';
      default:
        return typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
    }
  };

  const formatContainerId = (containerId: string) => {
    if (!containerId) return 'Not available';
    return containerId.length > 12 ? `${containerId.substring(0, 12)}...` : containerId;
  };

  const formatConfigPath = (path: string) => {
    if (!path) return 'Not available';
    const parts = path.split('/');
    return parts.length > 3 ? `.../${parts.slice(-2).join('/')}` : path;
  };

  if (loading && !pipeline) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Pipeline not found</h2>
        <Button onClick={() => navigate('/pipelines')}>
          Back to Pipelines
        </Button>
      </div>
    );
  }

  const sourceDetails = formatSourceDetails(pipeline.sources_config);
  const transformDetails = formatTransformDetails(pipeline.transforms_config);
  const sinkDetails = formatSinkDetails(pipeline.sinks_config);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/pipelines')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{pipeline.name}</h1>
              {getStatusIcon(pipeline.status)}
            </div>
            <p className="text-gray-600">{pipeline.description || 'No description provided'}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={getStatusBadgeVariant(pipeline.status)}>
            {pipeline.status.toUpperCase()}
          </Badge>
          <Button
            variant="secondary"
            onClick={handleTogglePipeline}
            disabled={loading}
          >
            {pipeline.status === 'running' ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start
              </>
            )}
          </Button>
          <Button variant="secondary">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="secondary"
            onClick={() => setDeleteModal(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pipeline Status */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Status</h3>
                {getStatusIcon(pipeline.status)}
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Current Status</span>
                  <Badge variant={getStatusBadgeVariant(pipeline.status)}>
                    {pipeline.status}
                  </Badge>
                </div>
                {pipeline.started_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Started</span>
                    <span className="text-sm text-gray-900">{formatDate(pipeline.started_at)}</span>
                  </div>
                )}
                {pipeline.stopped_at && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Stopped</span>
                    <span className="text-sm text-gray-900">{formatDate(pipeline.stopped_at)}</span>
                  </div>
                )}
              </div>
            </Card>

            {/* Sources Summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Sources</h3>
                <Server className="h-5 w-5 text-blue-500" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Sources</span>
                  <span className="text-sm font-semibold text-gray-900">{sourceDetails.totalCount}</span>
                </div>
                {sourceDetails.sources.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Primary Type</span>
                    <span className="text-sm text-gray-900 capitalize">
                      {sourceDetails.sources[0].type}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Transforms Summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Transforms</h3>
                <Workflow className="h-5 w-5 text-green-500" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Steps</span>
                  <span className="text-sm font-semibold text-gray-900">{transformDetails.totalCount}</span>
                </div>
                {transformDetails.transforms.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Pipeline</span>
                    <span className="text-sm text-gray-900">
                      {transformDetails.transforms[0].transforms.join(' → ')}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Sinks Summary */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Sinks</h3>
                <Database className="h-5 w-5 text-orange-500" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Total Outputs</span>
                  <span className="text-sm font-semibold text-gray-900">{sinkDetails.totalCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Types</span>
                  <span className="text-sm text-gray-900">
                    {sinkDetails.uniqueTypes.map(getSinkDisplayName).join(', ')}
                  </span>
                </div>
              </div>
            </Card>          </div>

          {/* Pipeline Flow Visualization */}
          <PipelineFlowVisualization pipeline={pipeline} />

          {/* Detailed Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sources Detail */}
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Server className="h-5 w-5 mr-2 text-blue-500" />
                Data Sources
              </h3>
              {sourceDetails.sources.length > 0 ? (
                <div className="space-y-4">
                  {sourceDetails.sources.map((source) => (
                    <div key={source.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {source.icon}
                          <span className="text-sm font-medium text-gray-900">
                            {source.id}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {source.type}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">{source.description}</p>
                      {source.type === 'file' && source.config.include && (
                        <div className="mt-2">
                          <span className="text-xs text-gray-500">File Patterns:</span>
                          <div className="mt-1 space-y-1">
                            {source.config.include.map((pattern: string, idx: number) => (
                              <code key={idx} className="block text-xs bg-gray-100 px-2 py-1 rounded">
                                {pattern}
                              </code>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No sources configured</p>
              )}
            </Card>

            {/* Sinks Detail */}
            <Card className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Database className="h-5 w-5 mr-2 text-orange-500" />
                Data Sinks
              </h3>
              {sinkDetails.sinks.length > 0 ? (
                <div className="space-y-4">
                  {sinkDetails.sinks.map((sink) => (
                    <div key={sink.sourceId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          From: {sink.sourceId}
                        </span>
                        <span className="text-xs text-gray-500">
                          {sink.count} output(s)
                        </span>
                      </div>                      <div className="flex flex-wrap gap-2">
                        {sink.sinks.map((sinkItem: any, idx: number) => {
                          // Extract type from both string and object formats
                          const sinkType = typeof sinkItem === 'string' ? sinkItem : sinkItem.type || 'unknown';
                          
                          return (
                            <div key={idx} className="flex items-center space-x-1 bg-gray-100 px-2 py-1 rounded">
                              {getSinkIcon(sinkType)}
                              <span className="text-xs text-gray-700">
                                {getSinkDisplayName(sinkType)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No sinks configured</p>
              )}
            </Card>
          </div>

          {/* Runtime Information */}
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Container className="h-5 w-5 mr-2 text-purple-500" />
              Runtime Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <span className="text-sm text-gray-500">Container ID</span>
                <p className="text-sm font-mono text-gray-900">
                  {formatContainerId(pipeline.container_id || '')}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Config File</span>
                <p className="text-sm font-mono text-gray-900">
                  {formatConfigPath(pipeline.config_path || '')}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Created</span>
                <p className="text-sm text-gray-900">{formatDate(pipeline.created_at)}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Last Updated</span>
                <p className="text-sm text-gray-900">{formatDate(pipeline.updated_at)}</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Full Pipeline Configuration</h3>
            <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
              {JSON.stringify({
                id: pipeline.id,
                name: pipeline.name,
                description: pipeline.description,
                sources: pipeline.sources_config,
                transforms: pipeline.transforms_config,
                sinks: pipeline.sinks_config,
                container_id: pipeline.container_id,
                config_path: pipeline.config_path,
                status: pipeline.status,
                created_at: pipeline.created_at,
                updated_at: pipeline.updated_at
              }, null, 2)}
            </pre>
          </Card>
        </TabsContent>        <TabsContent value="metrics" className="space-y-6">
          <PipelineMetrics 
            pipelineId={pipeline.id}
            pipelineName={pipeline.name}
            pipelineStatus={pipeline.status}
          />
        </TabsContent>

        <TabsContent value="logs" className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Pipeline Logs</h3>
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4" />
              <p>Logs will be displayed here when available</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Delete Pipeline"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete the pipeline "<strong>{pipeline.name}</strong>"? 
            This action cannot be undone and will stop the running container.
          </p>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="error"
              onClick={handleDeletePipeline}
            >
              Delete Pipeline
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
