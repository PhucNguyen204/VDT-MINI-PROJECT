import React from 'react';
import { useCreatePipelineStore } from '../../store';
import { Input, Textarea } from '../ui/FormElements';

export const BasicInfoStep: React.FC = () => {
  const { formData, updateFormData } = useCreatePipelineStore();

  return (
    <div className="space-y-6">
      <div>
        <Input
          label="Pipeline Name"
          type="text"
          value={formData.name}
          onChange={(value) => updateFormData({ name: value })}
          placeholder="Enter pipeline name"
          required
        />
      </div>

      <div>
        <Textarea
          label="Description"
          value={formData.description}
          onChange={(value) => updateFormData({ description: value })}
          placeholder="Describe what this pipeline does"
          rows={4}
        />
      </div>

      <div>
        <Input
          label="Tags (comma-separated)"
          type="text"
          value={formData.tags.join(', ')}
          onChange={(value) => updateFormData({ 
            tags: value.split(',').map(tag => tag.trim()).filter(Boolean)
          })}
          placeholder="e.g., data-processing, ML, production"
        />
      </div>
    </div>
  );
};
