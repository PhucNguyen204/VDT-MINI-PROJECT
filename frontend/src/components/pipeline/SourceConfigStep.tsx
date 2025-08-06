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
  { value: 'docker_logs', label: 'Docker Logs' },
  { value: 'syslog', label: 'Syslog' },
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
            <div className="space-y-4">
              {/* File Path Suggestion */}
              <div className="mb-3">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleConfigUpdate({ 
                    patterns: ['/runtime/logs/*.log']
                  })}
                >
                  💡 Dùng đường dẫn mặc định: /runtime/logs/*.log
                </Button>
              </div>
              
              <Input
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

          {currentSource.source.type === 'docker_logs' && (
            <div className="space-y-4">
              <Input
                label="Include Containers (comma-separated)"
                type="text"
                value={currentSource.source.include_containers?.join(', ') || ''}
                onChange={(value) => handleConfigUpdate({ 
                  include_containers: value.split(',').map(c => c.trim()).filter(Boolean)
                })}
                placeholder="container1, container2"
              />
              <Input
                label="Exclude Containers (comma-separated)"
                type="text"
                value={currentSource.source.exclude_containers?.join(', ') || ''}
                onChange={(value) => handleConfigUpdate({ 
                  exclude_containers: value.split(',').map(c => c.trim()).filter(Boolean)
                })}
                placeholder="excluded1, excluded2"
              />
            </div>
          )}

          {currentSource.source.type === 'syslog' && (
            <div className="space-y-4">
              <Select
                label="Mode"
                value={currentSource.source.mode || 'tcp'}
                onChange={(value) => handleConfigUpdate({ mode: value })}
                options={[
                  { value: 'tcp', label: 'TCP' },
                  { value: 'udp', label: 'UDP' }
                ]}
              />
              <Input
                label="Address"
                type="text"
                value={currentSource.source.address || ''}
                onChange={(value) => handleConfigUpdate({ address: value })}
                placeholder="0.0.0.0:5514"
                required
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
                  <div className="space-y-4">
                    {/* S3 Configuration Suggestions */}
                    <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateSink(index, { 
                            config: { 
                              ...sink.config, 
                              bucket: 'phucnguyen204',
                              region: 'ap-southeast-2',
                              access_key_id: 'AKIA5YG3CCI7MXG5KIE7',
                              secret_access_key: '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',
                              key_prefix: 'demo/%Y/%m/%d/'
                            } 
                          })}
                        >
                          💡 Dùng thông tin S3 của tôi
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => updateSink(index, { 
                            config: { 
                              ...sink.config, 
                              key_prefix: `logs/${selectedSourceKey}/%Y/%m/%d/`
                            } 
                          })}
                        >
                          📁 Key prefix mặc định
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Bucket *"
                        value={sink.config.bucket || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, bucket: value } })}
                        placeholder="phucnguyen204"
                        required
                      />
                      <Input
                        label="Region *"
                        value={sink.config.region || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, region: value } })}
                        placeholder="ap-southeast-2"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Access Key ID *"
                        value={sink.config.access_key_id || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, access_key_id: value } })}
                        placeholder="AKIA5YG3CCI7MXG5KIE7"
                        required
                      />
                      <Input
                        label="Secret Access Key *"
                        type="password"
                        value={sink.config.secret_access_key || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, secret_access_key: value } })}
                        placeholder="Your secret key"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Input
                        label="Key Prefix"
                        value={sink.config.key_prefix || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, key_prefix: value } })}
                        placeholder="logs/%Y/%m/%d/"
                      />
                      <Select
                        label="Compression"
                        value={sink.config.compression || 'gzip'}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, compression: value } })}
                        options={[
                          { value: 'none', label: 'None' },
                          { value: 'gzip', label: 'Gzip' },
                          { value: 'lz4', label: 'LZ4' }
                        ]}
                      />
                      <Select
                        label="Format"
                        value={sink.config.encoding || 'json'}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, encoding: value } })}
                        options={[
                          { value: 'json', label: 'JSON' },
                          { value: 'text', label: 'Text' },
                          { value: 'csv', label: 'CSV' }
                        ]}
                      />
                    </div>
                  </div>
                )}

                {sink.type === 'elasticsearch' && (
                  <div className="space-y-4">
                    <Input
                      label="Endpoints (comma-separated) *"
                      value={sink.config.endpoints?.join(', ') || ''}
                      onChange={(value) => updateSink(index, { 
                        config: { 
                          ...sink.config, 
                          endpoints: value.split(',').map(e => e.trim()).filter(Boolean)
                        } 
                      })}
                      placeholder="http://localhost:9200"
                      required
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Index"
                        value={sink.config.index || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, index: value } })}
                        placeholder="logs-%Y.%m.%d"
                      />
                      <Input
                        label="Doc Type"
                        value={sink.config.doc_type || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, doc_type: value } })}
                        placeholder="_doc"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Username"
                        value={sink.config.username || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, username: value } })}
                        placeholder="elastic"
                      />
                      <Input
                        label="Password"
                        type="password"
                        value={sink.config.password || ''}
                        onChange={(value) => updateSink(index, { config: { ...sink.config, password: value } })}
                        placeholder="password"
                      />
                    </div>
                  </div>
                )}

                {sink.type === 'console' && (
                  <div className="space-y-4">
                    <Select
                      label="Format"
                      value={sink.config.encoding || 'json'}
                      onChange={(value) => updateSink(index, { config: { ...sink.config, encoding: value } })}
                      options={[
                        { value: 'json', label: 'JSON' },
                        { value: 'text', label: 'Text' },
                        { value: 'csv', label: 'CSV' }
                      ]}
                    />
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={sink.config.pretty_print || false}
                        onChange={(e) => updateSink(index, { 
                          config: { ...sink.config, pretty_print: e.target.checked } 
                        })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Pretty Print</span>
                    </label>
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
