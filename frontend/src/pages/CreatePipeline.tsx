import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useCreatePipelineStore, usePipelineStore } from '../store';
import { Card, Progress } from '../components/ui/UIElements';
import { Button } from '../components/ui/FormElements';
import { BasicInfoStep } from '../components/pipeline/BasicInfoStep';
import { SourceConfigStep } from '../components/pipeline/SourceConfigStep';
import { ReviewStep } from '../components/pipeline/ReviewStep';

const steps = [
  { id: 1, name: 'Basic Info', component: BasicInfoStep },
  { id: 2, name: 'Sources & Configuration', component: SourceConfigStep },
  { id: 3, name: 'Review', component: ReviewStep },
];

export const CreatePipeline: React.FC = () => {
  const navigate = useNavigate();
  const { createPipeline } = usePipelineStore();
  const { 
    currentStep, 
    formData, 
    setCurrentStep, 
    resetForm,
    isStepValid 
  } = useCreatePipelineStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepData = steps[currentStep];
  const StepComponent = currentStepData?.component;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const result = await createPipeline(formData);
      resetForm();
      navigate(`/pipelines/${result.id}`);
    } catch (error) {
      console.error('Failed to create pipeline:', error);
    } finally {
      setIsSubmitting(false);
    }
  };
  const canGoNext = isStepValid(currentStep + 1); // isStepValid expects 1-based indexing
  const canGoPrevious = currentStep > 0;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Pipeline</h1>
          <p className="text-gray-600">Set up a new vector data processing pipeline</p>
        </div>        <Button
          variant="secondary"
          onClick={() => navigate('/pipelines')}
        >
          Cancel
        </Button>
      </div>

      {/* Progress */}
      <Card className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500">
              {Math.round(progress)}% complete
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {steps.map((step, stepIdx) => (
              <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">                  {stepIdx !== steps.length - 1 && (
                    <div className={`h-0.5 w-full ${stepIdx <= currentStep ? 'bg-primary-600' : 'bg-gray-200'}`} />
                  )}
                </div>
                <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white">
                  {stepIdx < currentStep ? (
                    <Check className="h-5 w-5 text-primary-600" />
                  ) : stepIdx === currentStep ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-600" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-transparent border-2 border-gray-300" />
                  )}
                </div>
                <span className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-gray-500 whitespace-nowrap">
                  {step.name}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </Card>      {/* Step Content */}
      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">
            {currentStepData?.name}
          </h2>
          {StepComponent && <StepComponent />}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-6 border-t border-gray-200">          <Button
            variant="secondary"
            onClick={handlePrevious}
            disabled={!canGoPrevious}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            Previous
          </Button>
          
          {isLastStep ? (
            <Button
              onClick={handleSubmit}
              disabled={!canGoNext || isSubmitting}
              loading={isSubmitting}
            >
              Create Pipeline
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canGoNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};
