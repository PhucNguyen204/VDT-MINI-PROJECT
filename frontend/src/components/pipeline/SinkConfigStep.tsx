import React from 'react';
import { useCreatePipelineStore } from '../../store';
import { Input, Select, Checkbox, Button } from '../ui/FormElements';
import { Card } from '../ui/UIElements';
import { SinkFormData } from '../../types';

const sinkTypes = [
  { value: 'console', label: 'Console Output' },
  { value: 's3', label: 'Amazon S3' },
  { value: 'cloudwatch', label: 'CloudWatch Logs' },
  { value: 'elasticsearch', label: 'Elasticsearch' },
];

export const SinkConfigStep: React.FC = () => {
  const { formData, updateFormData } = useCreatePipelineStore();

  const addSink = (type: string) => {
    const sinkKey = `sink${Object.keys(formData.sinks).length + 1}`;
    const newSink: SinkFormData = {
      type: type as any,
      config: {}
    };
    
    updateFormData({
      sinks: {
        ...formData.sinks,
        [sinkKey]: [newSink]
      }
    });
  };

  const removeSink = (key: string) => {
    const { [key]: removed, ...rest } = formData.sinks;
    updateFormData({
      sinks: rest
    });
  };

  const updateSink = (key: string, updates: Partial<SinkFormData>) => {
    const currentSinks = formData.sinks[key] || [];
    if (currentSinks.length > 0) {
      const updatedSink = { ...currentSinks[0], ...updates };
      updateFormData({
        sinks: {
          ...formData.sinks,
          [key]: [updatedSink]
        }
      });
    }
  };

  const updateSinkConfig = (key: string, configUpdates: any) => {
    const currentSinks = formData.sinks[key] || [];
    if (currentSinks.length > 0) {
      updateSink(key, {
        config: {
          ...currentSinks[0].config,
          ...configUpdates
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Output Sinks</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            {sinkTypes.map(type => (
              <Button
                key={type.value}
                onClick={() => addSink(type.value)}
                variant="secondary"
                size="sm"
              >
                Add {type.label}
              </Button>
            ))}
          </div>

          {Object.entries(formData.sinks).length === 0 && (
            <p className="text-gray-500 text-sm">No sinks configured. Click above to add output destinations.</p>
          )}

          {Object.entries(formData.sinks).map(([key, sinks]) => {
            const sink = sinks[0];
            if (!sink) return null;

            return (
              <Card key={key} className="p-4 border border-gray-200">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-medium text-gray-900">
                    Sink: {sinkTypes.find(t => t.value === sink.type)?.label || sink.type}
                  </h4>
                  <Button
                    onClick={() => removeSink(key)}
                    variant="error"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
                
                {sink.type === 'console' && (
                  <div className="space-y-3">
                    <Checkbox
                      label="Pretty Print"
                      checked={sink.config.prettyPrint || false}
                      onChange={(checked) => updateSinkConfig(key, { prettyPrint: checked })}
                    />
                    <Checkbox
                      label="Include Metadata"
                      checked={sink.config.includeMetadata || false}
                      onChange={(checked) => updateSinkConfig(key, { includeMetadata: checked })}
                    />
                  </div>
                )}

                {sink.type === 's3' && (
                  <div className="space-y-3">
                    <Input
                      label="S3 Bucket"
                      type="text"
                      value={sink.config.bucket || ''}
                      onChange={(value) => updateSinkConfig(key, { bucket: value })}
                      placeholder="my-bucket"
                      required
                    />
                    <Input
                      label="Region"
                      type="text"
                      value={sink.config.region || ''}
                      onChange={(value) => updateSinkConfig(key, { region: value })}
                      placeholder="us-west-2"
                      required
                    />
                    <Input
                      label="Prefix"
                      type="text"
                      value={sink.config.prefix || ''}
                      onChange={(value) => updateSinkConfig(key, { prefix: value })}
                      placeholder="logs/pipeline/"
                    />
                  </div>
                )}

                {sink.type === 'cloudwatch' && (
                  <div className="space-y-3">
                    <Input
                      label="Log Group"
                      type="text"
                      value={sink.config.logGroup || ''}
                      onChange={(value) => updateSinkConfig(key, { logGroup: value })}
                      placeholder="/aws/lambda/my-function"
                      required
                    />
                    <Input
                      label="Stream Name"
                      type="text"
                      value={sink.config.streamName || ''}
                      onChange={(value) => updateSinkConfig(key, { streamName: value })}
                      placeholder="stream-name"
                    />
                  </div>
                )}                {sink.type === 'elasticsearch' && (
                  <div className="space-y-3">
                    <Input
                      label="Index Name"
                      type="text"
                      value={sink.config.index || ''}
                      onChange={(value) => updateSinkConfig(key, { index: value })}
                      placeholder="logs-pipeline"
                      required
                    />
                    <Input
                      label="Index Type"
                      type="text"
                      value={sink.config.indexType || ''}
                      onChange={(value) => updateSinkConfig(key, { indexType: value })}
                      placeholder="_doc"
                    />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
