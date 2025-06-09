import React from 'react';
import { useCreatePipelineStore } from '../../store';
import { Card } from '../ui/UIElements';

export const ReviewStep: React.FC = () => {
  const { formData } = useCreatePipelineStore();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Review Pipeline Configuration</h3>
        
        <div className="space-y-6">
          {/* Basic Info */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Basic Information</h4>
            <div className="bg-gray-50 p-4 rounded-md">
              <p><span className="font-medium">Name:</span> {formData.name}</p>
              <p><span className="font-medium">Description:</span> {formData.description || 'No description'}</p>
              <p><span className="font-medium">Tags:</span> {formData.tags.length > 0 ? formData.tags.join(', ') : 'None'}</p>
            </div>
          </div>

          {/* Sources */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Data Sources</h4>
            <div className="bg-gray-50 p-4 rounded-md">              {Object.keys(formData.sources).length === 0 ? (
                <p className="text-gray-500">No sources configured</p>
              ) : (
                Object.entries(formData.sources).map(([key, sourceConfig]) => (
                  <div key={key} className="mb-4 border-b pb-2">
                    <p><span className="font-medium">{key}:</span> {sourceConfig.source.type}</p>
                    <div className="ml-4 mt-2 text-sm text-gray-600">
                      <p>Transforms: {sourceConfig.transforms.join(', ') || 'None'}</p>
                      <p>Sinks: {sourceConfig.sinks.length} configured</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>          {/* Transforms */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Transforms</h4>
            <div className="bg-gray-50 p-4 rounded-md">
              {Object.keys(formData.sources).length === 0 ? (
                <p className="text-gray-500">No transforms configured</p>
              ) : (
                Object.entries(formData.sources).map(([key, sourceConfig]) => (
                  <div key={key} className="mb-2">
                    <p><span className="font-medium">{key}:</span> {sourceConfig.transforms.join(', ') || 'None'}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sinks */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Output Sinks</h4>
            <div className="bg-gray-50 p-4 rounded-md">
              {Object.keys(formData.sources).length === 0 ? (
                <p className="text-gray-500">No sinks configured</p>
              ) : (
                Object.entries(formData.sources).map(([key, sourceConfig]) => (
                  <div key={key} className="mb-2">
                    <p><span className="font-medium">{key}:</span></p>
                    {sourceConfig.sinks.map((sink, index) => (
                      <p key={index} className="ml-4 text-sm text-gray-600">
                        - {sink.type} {sink.config.bucket && `(${sink.config.bucket})`}
                      </p>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 bg-blue-50 border-blue-200">
        <h4 className="font-medium text-blue-900 mb-2">Ready to Create Pipeline</h4>
        <p className="text-blue-800 text-sm">
          Review the configuration above. When you're ready, click "Create Pipeline" to build and deploy your data processing pipeline.
        </p>
      </Card>
    </div>
  );
};
