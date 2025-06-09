import React from 'react';
import { 
  Database, 
  FileText, 
  Globe, 
  BarChart3, 
  ArrowRight, 
  Zap, 
  FileCode,
  Server,
  Activity
} from 'lucide-react';

interface PipelineFlowProps {
  pipeline: {
    id: string;
    name: string;
    sources_config: Record<string, any>;
    transforms_config: Record<string, string[]>;
    sinks_config: Record<string, any>;
  };
}

export const PipelineFlowVisualization: React.FC<PipelineFlowProps> = ({ pipeline }) => {
  // Helper functions for icons and display names
  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="h-6 w-6 text-blue-500" />;
      case 'http':
        return <Globe className="h-6 w-6 text-green-500" />;
      case 'prometheus_scrape':
        return <BarChart3 className="h-6 w-6 text-purple-500" />;
      case 'docker_logs':
        return <Server className="h-6 w-6 text-gray-500" />;
      default:
        return <Database className="h-6 w-6 text-gray-400" />;
    }
  };

  const getSinkIcon = (type: string) => {
    switch (type) {
      case 's3':
        return <Database className="h-5 w-5 text-orange-500" />;
      case 'console':
        return <FileCode className="h-5 w-5 text-gray-500" />;
      case 'cloudwatch':
        return <BarChart3 className="h-5 w-5 text-blue-500" />;
      case 'elasticsearch':
        return <Server className="h-5 w-5 text-green-500" />;
      default:
        return <Database className="h-5 w-5 text-gray-400" />;
    }
  };

  const getTransformIcon = (transform: string) => {
    switch (transform) {
      case 'parse':
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'enrich':
        return <Activity className="h-4 w-4 text-blue-500" />;
      case 'reduce':
        return <BarChart3 className="h-4 w-4 text-purple-500" />;
      default:
        return <Zap className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSourceDisplayName = (type: string) => {
    switch (type) {
      case 'file':
        return 'File Source';
      case 'http':
        return 'HTTP Server';
      case 'prometheus_scrape':
        return 'Prometheus Scraper';
      case 'docker_logs':
        return 'Docker Logs';
      default:
        return type;
    }
  };

  const getSinkDisplayName = (type: string) => {
    switch (type) {
      case 's3':
        return 'AWS S3';
      case 'console':
        return 'Console';
      case 'cloudwatch':
        return 'CloudWatch';
      case 'elasticsearch':
        return 'Elasticsearch';
      default:
        return type;
    }
  };
  // Build pipeline flow data
  const buildFlowData = () => {
    const flows: Array<{
      sourceId: string;
      sourceType: string;
      sourceConfig: any;
      transforms: string[];
      sinks: any[];
    }> = [];

    // Safety check for pipeline and its configuration objects
    if (!pipeline || !pipeline.sources_config) {
      return flows;
    }

    Object.entries(pipeline.sources_config).forEach(([sourceId, sourceConfig]) => {
      const transforms = pipeline.transforms_config?.[sourceId] || [];
      const sinks = pipeline.sinks_config?.[sourceId] || [];
      
      flows.push({
        sourceId,
        sourceType: sourceConfig?.type || 'unknown',
        sourceConfig: sourceConfig || {},
        transforms: Array.isArray(transforms) ? transforms : [],
        sinks: Array.isArray(sinks) ? sinks : []
      });
    });

    return flows;
  };

  const flows = buildFlowData();

  return (
    <div className="bg-white p-6 rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Pipeline Flow Visualization</h3>
      
      <div className="space-y-8">
        {flows.map((flow, flowIndex) => (
          <div key={flow.sourceId} className="relative">
            {/* Flow Container */}
            <div className="flex items-center space-x-4 overflow-x-auto pb-4">
              
              {/* Source */}
              <div className="flex-shrink-0">
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 min-w-[200px]">
                  <div className="flex items-center space-x-3 mb-2">
                    {getSourceIcon(flow.sourceType)}
                    <div>
                      <h4 className="font-medium text-gray-900">{flow.sourceId}</h4>
                      <p className="text-sm text-gray-500">{getSourceDisplayName(flow.sourceType)}</p>
                    </div>
                  </div>
                  
                  {/* Source Configuration Details */}
                  <div className="text-xs text-gray-600 mt-2 space-y-1">
                    {flow.sourceType === 'file' && flow.sourceConfig.include && (
                      <div>
                        <span className="font-medium">Files:</span>
                        <div className="ml-2">
                          {flow.sourceConfig.include.map((path: string, idx: number) => (
                            <div key={idx} className="truncate">{path}</div>
                          ))}
                        </div>
                      </div>
                    )}
                    {flow.sourceType === 'http' && (
                      <div>
                        <span className="font-medium">Port:</span> {flow.sourceConfig.listen_port || 8088}
                      </div>
                    )}
                    {flow.sourceType === 'prometheus_scrape' && flow.sourceConfig.endpoints && (
                      <div>
                        <span className="font-medium">Endpoints:</span>
                        <div className="ml-2">
                          {flow.sourceConfig.endpoints.map((endpoint: string, idx: number) => (
                            <div key={idx} className="truncate">{endpoint}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Arrow to Transforms */}
              {flow.transforms.length > 0 && (
                <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
              )}

              {/* Transforms */}
              {flow.transforms.length > 0 && (
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {flow.transforms.map((transform, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 min-w-[120px]">
                        <div className="flex items-center space-x-2">
                          {getTransformIcon(transform)}
                          <div>
                            <p className="text-sm font-medium text-gray-900 capitalize">{transform}</p>
                            <p className="text-xs text-gray-500">Transform</p>
                          </div>
                        </div>
                      </div>
                      {idx < flow.transforms.length - 1 && (
                        <ArrowRight className="h-4 w-4 text-gray-300" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Arrow to Sinks */}
              {flow.sinks.length > 0 && (
                <ArrowRight className="h-6 w-6 text-gray-400 flex-shrink-0" />
              )}

              {/* Sinks */}
              {flow.sinks.length > 0 && (
                <div className="flex flex-col space-y-2 flex-shrink-0">
                  {flow.sinks.map((sink, idx) => {
                    const sinkType = typeof sink === 'string' ? sink : sink.type || 'unknown';
                    const sinkConfig = typeof sink === 'object' ? sink.config : {};
                    
                    return (
                      <div key={idx} className="bg-green-50 border border-green-200 rounded-lg p-3 min-w-[180px]">
                        <div className="flex items-center space-x-2 mb-2">
                          {getSinkIcon(sinkType)}
                          <div>
                            <p className="text-sm font-medium text-gray-900">{getSinkDisplayName(sinkType)}</p>
                            <p className="text-xs text-gray-500">Sink #{idx + 1}</p>
                          </div>
                        </div>
                        
                        {/* Sink Configuration Details */}
                        {sinkType === 's3' && sinkConfig && (
                          <div className="text-xs text-gray-600 space-y-1">
                            {sinkConfig.bucket && (
                              <div><span className="font-medium">Bucket:</span> {sinkConfig.bucket}</div>
                            )}
                            {sinkConfig.region && (
                              <div><span className="font-medium">Region:</span> {sinkConfig.region}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Flow Separator */}
            {flowIndex < flows.length - 1 && (
              <div className="border-b border-gray-200 mt-6"></div>
            )}
          </div>
        ))}
      </div>      {/* Pipeline Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-blue-600">
              {pipeline?.sources_config ? Object.keys(pipeline.sources_config).length : 0}
            </p>
            <p className="text-sm text-gray-600">Sources</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-yellow-600">
              {pipeline?.transforms_config ? Object.values(pipeline.transforms_config).flat().length : 0}
            </p>
            <p className="text-sm text-gray-600">Transforms</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-2xl font-bold text-green-600">
              {pipeline?.sinks_config ? Object.values(pipeline.sinks_config).flat().length : 0}
            </p>
            <p className="text-sm text-gray-600">Sinks</p>
          </div>
        </div>
      </div>
    </div>
  );
};
