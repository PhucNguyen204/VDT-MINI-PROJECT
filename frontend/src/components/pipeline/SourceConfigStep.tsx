import React, { useState } from 'react';
import { useCreatePipelineStore } from '../../store';
import { Input, Select, Button } from '../ui/FormElements';
import { Card } from '../ui/UIElements';
import { SourceFormData } from '../../types';
import { Plus, Trash2 } from 'lucide-react';

const sourceTypes = [
  { value: 'file', label: 'File System' },
  { value: 'http', label: 'HTTP Endpoint' },
  { value: 'prometheus_scrape', label: 'Prometheus Scrape' },
];

export const SourceConfigStep: React.FC = () => {
  const { formData, updateFormData } = useCreatePipelineStore();
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>(() => {
    const keys = Object.keys(formData.sources);
    return keys.length > 0 ? keys[0] : '';
  });
  const addNewSource = () => {
    const sourceCount = Object.keys(formData.sources).length;
    const newSourceKey = `source_${sourceCount + 1}`;
    
    const newSources = { ...formData.sources };    newSources[newSourceKey] = {
      source: { type: 'file' },
      transforms: [],
      sinks: [{
        type: 's3',
        config: {}
      }]
    };
    
    updateFormData({ sources: newSources });
    setSelectedSourceKey(newSourceKey);
  };
  const removeSource = (sourceKey: string) => {
    const { [sourceKey]: removedSource, ...remainingSources } = formData.sources;
    
    updateFormData({ sources: remainingSources });

    // Select first remaining source or clear selection
    const remainingKeys = Object.keys(remainingSources);
    setSelectedSourceKey(remainingKeys.length > 0 ? remainingKeys[0] : '');
  };
  const currentSource = selectedSourceKey ? formData.sources[selectedSourceKey] : null;

  const handleSourceUpdate = (updates: Partial<SourceFormData>) => {
    if (!selectedSourceKey || !currentSource) return;
    
    const newSources = { ...formData.sources };
    newSources[selectedSourceKey] = {
      ...currentSource,
      source: {
        ...currentSource.source,
        ...updates
      }
    };
    
    updateFormData({ sources: newSources });
  };
  const handleConfigUpdate = (configUpdates: any) => {
    handleSourceUpdate(configUpdates);
  };

  const updateTransforms = (transforms: string[]) => {
    if (!selectedSourceKey || !currentSource) return;
    
    const newSources = { ...formData.sources };
    newSources[selectedSourceKey] = {
      ...currentSource,
      transforms
    };
    
    updateFormData({ sources: newSources });
  };

  const addSink = () => {
    if (!selectedSourceKey || !currentSource) return;
    
    const newSink = {
      type: 's3' as const,
      config: {}
    };
    
    const newSources = { ...formData.sources };
    newSources[selectedSourceKey] = {
      ...currentSource,
      sinks: [...currentSource.sinks, newSink]
    };
    
    updateFormData({ sources: newSources });
  };

  const removeSink = (index: number) => {
    if (!selectedSourceKey || !currentSource) return;
    
    const newSources = { ...formData.sources };
    newSources[selectedSourceKey] = {
      ...currentSource,
      sinks: currentSource.sinks.filter((_, i) => i !== index)
    };
    
    updateFormData({ sources: newSources });
  };

  const updateSink = (index: number, updates: any) => {
    if (!selectedSourceKey || !currentSource) return;
    
    const newSources = { ...formData.sources };
    const newSinks = [...currentSource.sinks];
    newSinks[index] = { ...newSinks[index], ...updates };
    
    newSources[selectedSourceKey] = {
      ...currentSource,
      sinks: newSinks
    };
    
    updateFormData({ sources: newSources });
  };

  // Start with one source if none exist
  if (Object.keys(formData.sources).length === 0) {
    addNewSource();
    return <div>Loading...</div>;
  }  return (
    <div className="space-y-6">
      {/* Source List and Add Button */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Data Sources</h3>
          <Button
            variant="secondary"
            onClick={addNewSource}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Source
          </Button>
        </div>

        {/* Source Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(formData.sources).map((sourceKey) => (
            <button
              key={sourceKey}
              onClick={() => setSelectedSourceKey(sourceKey)}
              className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                selectedSourceKey === sourceKey
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sourceKey}
              {Object.keys(formData.sources).length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSource(sourceKey);
                  }}
                  className="ml-1 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </button>
          ))}
        </div>
      </Card>

      {/* Source Configuration */}
      {currentSource && (
        <Card className="p-6">
          <h4 className="text-md font-medium text-gray-900 mb-4">
            Configure {selectedSourceKey}
          </h4>
          <div className="space-y-4">          <Select
            label="Source Type"
            value={currentSource.source.type}
            onChange={(value) => handleSourceUpdate({ type: value as any })}
            options={sourceTypes}
            required
          />          {currentSource.source.type === 'file' && (
            <div className="space-y-4">              <Input
                label="File Patterns (comma-separated)"
                type="text"
                value={currentSource.source.patterns?.join(', ') || ''}
                onChange={(value) => handleConfigUpdate({ 
                  patterns: value.split(',').map(p => p.trim()).filter(Boolean)
                })}
                placeholder="/runtime/logs/*.log, /runtime/logs/*.txt"
                required
              />
            </div>
          )}{currentSource.source.type === 'http' && (
            <div className="space-y-4">
              <Input
                label="Port"
                type="number"
                value={currentSource.source.listen_port?.toString() || ''}
                onChange={(value) => handleConfigUpdate({ listen_port: parseInt(value) || 8080 })}
                placeholder="8080"
                required
              />
              <Input
                label="Path"
                type="text"
                value={currentSource.source.path || ''}
                onChange={(value) => handleConfigUpdate({ path: value })}
                placeholder="/webhook"
              />
            </div>
          )}          {currentSource.source.type === 'prometheus_scrape' && (
            <div className="space-y-4">
              <Input
                label="Endpoints (comma-separated)"
                type="text"
                value={currentSource.source.endpoints?.join(', ') || ''}
                onChange={(value) => handleConfigUpdate({ 
                  endpoints: value.split(',').map(e => e.trim()).filter(Boolean)
                })}
                placeholder="http://localhost:9090/metrics"
                required
              />
              <Input
                label="Scrape Interval (seconds)"
                type="number"
                value={currentSource.source.scrape_interval?.toString() || ''}
                onChange={(value) => handleConfigUpdate({ scrape_interval: parseInt(value) || 30 })}
                placeholder="30"
              />
            </div>
          )}
        </div>
          {/* Transforms Configuration */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h5 className="text-sm font-medium text-gray-900 mb-3">Transforms</h5>
          <div className="space-y-2">
            {['parse', 'enrich', 'reduce'].map((transform) => (
              <label key={transform} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={currentSource.transforms.includes(transform)}
                  onChange={(e) => {
                    const newTransforms = e.target.checked
                      ? [...currentSource.transforms, transform]
                      : currentSource.transforms.filter(t => t !== transform);
                    updateTransforms(newTransforms);
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 capitalize">{transform}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Sinks Configuration */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <h5 className="text-sm font-medium text-gray-900">Output Sinks</h5>
            <Button
              variant="secondary"
              onClick={addSink}
              className="text-xs px-2 py-1"
            >
              Add Sink
            </Button>
          </div>
          <div className="space-y-4">
            {currentSource.sinks.map((sink, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <Select
                    label="Sink Type"
                    value={sink.type}
                    onChange={(value) => updateSink(index, { type: value as any })}
                    options={[
                      { value: 's3', label: 'Amazon S3' },
                      { value: 'console', label: 'Console' },
                      { value: 'cloudwatch', label: 'CloudWatch' },
                      { value: 'elasticsearch', label: 'Elasticsearch' }
                    ]}
                  />
                  {currentSource.sinks.length > 1 && (
                    <Button
                      variant="secondary"
                      onClick={() => removeSink(index)}
                      className="text-xs px-2 py-1 ml-2 text-red-600"
                    >
                      Remove
                    </Button>
                  )}
                </div>
                
                {sink.type === 's3' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Bucket"
                      value={sink.config.bucket || ''}
                      onChange={(value) => updateSink(index, { config: { ...sink.config, bucket: value } })}
                      placeholder="my-bucket"
                    />
                    <Input
                      label="Region"
                      value={sink.config.region || ''}
                      onChange={(value) => updateSink(index, { config: { ...sink.config, region: value } })}
                      placeholder="us-west-2"
                    />
                    <Input
                      label="Access Key ID"
                      value={sink.config.access_key_id || ''}
                      onChange={(value) => updateSink(index, { config: { ...sink.config, access_key_id: value } })}
                      placeholder="AKIA..."
                    />
                    <Input
                      label="Secret Access Key"
                      type="password"
                      value={sink.config.secret_access_key || ''}
                      onChange={(value) => updateSink(index, { config: { ...sink.config, secret_access_key: value } })}
                      placeholder="Secret key"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        </Card>
      )}
    </div>
  );
};
