import React from 'react';
import { useCreatePipelineStore } from '../../store';
import { Input, Select, Checkbox, Button } from '../ui/FormElements';
import { Card } from '../ui/UIElements';

const transformTypes = [
  { value: 'parse', label: 'Parse/Extract' },
  { value: 'enrich', label: 'Enrich' },
  { value: 'reduce', label: 'Reduce/Aggregate' },
];

export const TransformConfigStep: React.FC = () => {
  const { formData, updateFormData } = useCreatePipelineStore();

  const addTransform = (type: string) => {
    const transformKey = `transform${Object.keys(formData.transforms).length + 1}`;
    updateFormData({
      transforms: {
        ...formData.transforms,
        [transformKey]: [type]
      }
    });
  };

  const removeTransform = (key: string) => {
    const { [key]: removed, ...rest } = formData.transforms;
    updateFormData({
      transforms: rest
    });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Configure Transforms</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2">
            {transformTypes.map(type => (
              <Button
                key={type.value}
                onClick={() => addTransform(type.value)}
                variant="secondary"
                size="sm"
              >
                Add {type.label}
              </Button>
            ))}
          </div>

          {Object.entries(formData.transforms).length === 0 && (
            <p className="text-gray-500 text-sm">No transforms configured. Click above to add transforms.</p>
          )}

          {Object.entries(formData.transforms).map(([key, transforms]) => (
            <Card key={key} className="p-4 border border-gray-200">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium text-gray-900">Transform: {transforms[0]}</h4>
                <Button
                  onClick={() => removeTransform(key)}
                  variant="error"
                  size="sm"
                >
                  Remove
                </Button>
              </div>
              
              {transforms[0] === 'parse' && (
                <div className="space-y-3">
                  <Input
                    label="Field to Parse"
                    type="text"
                    placeholder="message"
                  />
                  <Select
                    label="Parser Type"
                    options={[
                      { value: 'json', label: 'JSON' },
                      { value: 'regex', label: 'Regex' },
                      { value: 'csv', label: 'CSV' },
                    ]}
                    placeholder="Select parser type"
                  />
                </div>
              )}

              {transforms[0] === 'enrich' && (
                <div className="space-y-3">
                  <Input
                    label="Enrichment Source"
                    type="text"
                    placeholder="geoip, user_lookup, etc."
                  />
                  <Input
                    label="Target Field"
                    type="text"
                    placeholder="enriched_data"
                  />
                </div>
              )}

              {transforms[0] === 'reduce' && (
                <div className="space-y-3">
                  <Input
                    label="Group By Field"
                    type="text"
                    placeholder="user_id"
                  />
                  <Select
                    label="Aggregation Function"
                    options={[
                      { value: 'count', label: 'Count' },
                      { value: 'sum', label: 'Sum' },
                      { value: 'avg', label: 'Average' },
                      { value: 'max', label: 'Maximum' },
                      { value: 'min', label: 'Minimum' },
                    ]}
                    placeholder="Select aggregation"
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};
